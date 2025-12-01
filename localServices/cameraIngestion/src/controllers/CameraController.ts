import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";
import ms from "ms";
import {
  StreamCapture,
  FrameData,
  StreamProperties,
  StreamConfig,
  createStreamCapture,
} from "../streams/streamInterface";
import { ContinuousRecorder } from "../recording/continuousRecorder";
import { emitFrame, emitStats } from "../socketHandler";
import { raiseEvent } from "../shared/events/notify";
import { redis } from "../shared/redis/index";
import { createClient, RedisClientType } from "redis";
import { RollingAverage } from "../utils/rollingAverage";
import { getCameraDecoder } from "../utils/hardwareDecoder";
import { getCameraEncoder } from "../utils/hardwareEncoder";
import {
  DEFAULT_STREAM_FPS,
  DEFAULT_STREAM_WIDTH,
  DEFAULT_STREAM_HEIGHT,
} from "../config";

/**
 * Motion detection result from Redis pub/sub
 * Published by motionDetection service on `motion:{cameraId}` channel
 */
export interface MotionDetectionResult {
  camera_id: string;
  /** Original frame capture timestamp (ms since epoch) - passed through from cameraIngestion */
  timestamp: number;
  motion_detected: boolean;
  motion_percentage: number;
  motion_regions: number;
  total_motion_pixels: number;
  processing_time_ms: number;
}

/**
 * Camera state machine states
 */
export type CameraState =
  | "idle"
  | "probing"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "disposed"
  | "error"
  | "retrying";

/**
 * Camera configuration from Redis
 */
export interface CameraConfig {
  cameraId: string;
  cameraName: string;
  streamUrl: string;
  motionDetectionEnabled: boolean;
  targetWidth?: number;
  targetHeight?: number;
}

/**
 * CameraController manages ALL processes for a single camera
 *
 * This is the unified controller that owns:
 * - FFprobe process (stream probing)
 * - FFmpeg stream capture process (raw frame extraction)
 * - FFmpeg recorder process (HLS recording)
 * - Frame processing (compression, Socket.IO emission, Redis publishing)
 *
 * State Machine:
 * idle → probing → starting → running → stopping → stopped
 *                                    ↘ disposed
 *
 * Key Benefits:
 * - Single disposal path (no race conditions)
 * - Coordinated lifecycle management
 * - All processes tracked in one place
 * - Clear state transitions
 */
export class CameraController extends EventEmitter {
  // Owned processes
  private streamCapture: StreamCapture | null = null;
  private recorder: ContinuousRecorder | null = null;
  private probeProcess: ChildProcess | null = null;

  // State management
  private _state: CameraState = "idle";
  private isDisposed: boolean = false;
  private disposalInProgress: boolean = false;

  // Stream properties (detected during probing)
  private streamProperties: StreamProperties | null = null;

  // Frame processing
  private frameCount: number = 0;
  private frameProcessingTimes = new RollingAverage(100);

  // Frame flow monitoring
  private lastFrameTime: number = 0;
  private frameFlowState: "healthy" | "warning" | "critical" = "healthy";
  private frameFlowCheckInterval: NodeJS.Timeout | null = null;
  private restartRequestedAt: number = 0; // Prevents duplicate restart requests

  // Motion detection stats (updated via Redis pub/sub)
  private motionProcessingTimes = new RollingAverage(100);
  private motionSubscriber: RedisClientType | null = null;

  constructor(private config: CameraConfig) {
    super();
  }

  /**
   * Log prefix for consistent logging
   */
  private get logPrefix(): string {
    return `[CameraController ${this.config.cameraName}]`;
  }

  /**
   * Get current state
   */
  get state(): CameraState {
    return this._state;
  }

  /**
   * Set state with logging
   */
  private setState(newState: CameraState): void {
    const oldState = this._state;
    this._state = newState;
    console.log(`${this.logPrefix} State: ${oldState} → ${newState}`);
    this.emit("stateChange", { oldState, newState });
  }

  /**
   * Start the camera - probes stream, starts capture and recording
   */
  async start(): Promise<void> {
    if (this.isDisposed) {
      console.warn(`${this.logPrefix} Cannot start - disposed`);
      return;
    }

    if (this._state === "running" || this._state === "starting") {
      console.warn(`${this.logPrefix} Already running or starting`);
      return;
    }

    try {
      // Phase 1: Probe stream
      this.setState("probing");
      this.streamProperties = await this.probe();

      if (this.isDisposed) {
        console.log(`${this.logPrefix} Disposed during probing`);
        return;
      }

      // Phase 2: Start stream capture and recorder
      this.setState("starting");
      await this.startStreamCapture();
      await this.startRecorder();

      // Phase 3: Start frame flow monitoring
      this.lastFrameTime = Date.now();
      this.frameFlowState = "healthy";
      this.startFrameFlowMonitoring();

      // Phase 4: Subscribe to motion detection results (if enabled)
      await this.subscribeToMotionResults();

      this.setState("running");
      this.emit("started");

      console.log(`${this.logPrefix} Started successfully`);
    } catch (error) {
      console.error(`${this.logPrefix} Failed to start:`, error);
      this.setState("error");
      throw error;
    }
  }

  /**
   * Stop the camera - stops all processes
   */
  async stop(): Promise<void> {
    if (
      this._state === "stopped" ||
      this._state === "idle" ||
      this._state === "disposed"
    ) {
      return;
    }

    this.setState("stopping");

    // Stop frame flow monitoring
    this.stopFrameFlowMonitoring();

    // Stop all processes in parallel
    await Promise.all([
      this.stopStreamCapture(),
      this.stopRecorder(),
      this.cancelProbe(),
    ]);

    this.frameCount = 0;
    this.setState("stopped");
    this.emit("stopped");
  }

  /**
   * Dispose the camera permanently - prevents any future restarts
   */
  async dispose(): Promise<void> {
    if (this.disposalInProgress || this.isDisposed) {
      return;
    }

    console.log(`${this.logPrefix} Disposing (permanent removal)`);

    this.disposalInProgress = true;
    this.isDisposed = true;

    // Cancel any pending operations SYNCHRONOUSLY
    this.stopFrameFlowMonitoring();
    this.cancelProbe();

    // Stop all processes and unsubscribe from motion results
    await Promise.all([
      this.stopStreamCapture(),
      this.stopRecorder(),
      this.unsubscribeFromMotionResults(),
    ]);

    // Dispose underlying resources
    if (this.streamCapture) {
      await this.streamCapture.dispose();
      this.streamCapture = null;
    }

    if (this.recorder) {
      await this.recorder.dispose();
      this.recorder = null;
    }

    this.removeAllListeners();
    this.setState("disposed");
  }

  /**
   * Update camera configuration
   * Restarts if stream URL or resolution changed
   */
  async updateConfig(newConfig: Partial<CameraConfig>): Promise<void> {
    const needsRestart = this.configRequiresRestart(newConfig);
    this.config = { ...this.config, ...newConfig };

    if (needsRestart && this._state === "running") {
      console.log(`${this.logPrefix} Config changed, restarting...`);
      await this.stop();
      await this.start();
    }
  }

  /**
   * Check if config change requires restart
   */
  private configRequiresRestart(newConfig: Partial<CameraConfig>): boolean {
    return (
      (newConfig.streamUrl !== undefined &&
        newConfig.streamUrl !== this.config.streamUrl) ||
      (newConfig.targetWidth !== undefined &&
        newConfig.targetWidth !== this.config.targetWidth) ||
      (newConfig.targetHeight !== undefined &&
        newConfig.targetHeight !== this.config.targetHeight)
    );
  }

  // ==================== PROBING ====================

  /**
   * Probe stream to detect native properties
   * Uses spawn() with explicit process tracking and cleanup
   */
  private async probe(): Promise<StreamProperties | null> {
    const streamUrl = this.config.streamUrl;
    const timeout = 10; // seconds

    console.log(
      `${this.logPrefix} Probing stream: ${this.maskStreamUrl(streamUrl)}`
    );

    // Retry up to 3 times
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (this.isDisposed) return null;

      try {
        const result = await this.executeProbe(streamUrl, timeout);
        console.log(
          `${this.logPrefix} Detected: ${result.width}x${result.height} @ ${result.fps}fps (${result.codec})`
        );
        return result;
      } catch (error) {
        console.warn(
          `${this.logPrefix} Probe attempt ${attempt}/3 failed: ${(error as Error).message}`
        );

        if (attempt < 3 && !this.isDisposed) {
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
          await this.sleep(delay);
        }
      }
    }

    console.warn(
      `${this.logPrefix} Probing failed after 3 attempts, using defaults`
    );
    return null;
  }

  /**
   * Execute a single probe using spawn() with explicit cleanup
   */
  private executeProbe(
    streamUrl: string,
    timeout: number
  ): Promise<StreamProperties> {
    return new Promise((resolve, reject) => {
      const args = this.buildFfprobeArgs(streamUrl, timeout);

      this.probeProcess = spawn("ffprobe", args);
      let stdout = "";
      let stderr = "";
      let killed = false;

      // Timeout handler - explicit kill
      const timeoutId = setTimeout(() => {
        killed = true;
        if (this.probeProcess) {
          this.probeProcess.kill("SIGKILL");
          this.probeProcess = null;
        }
        reject(new Error(`Probe timeout after ${timeout}s`));
      }, (timeout + 5) * 1000);

      this.probeProcess.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      this.probeProcess.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      this.probeProcess.on("close", (code) => {
        clearTimeout(timeoutId);
        this.probeProcess = null;

        if (killed) return;

        if (code !== 0) {
          reject(new Error(`FFprobe exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const probeData = JSON.parse(stdout);
          const videoStream = probeData.streams?.find(
            (s: { codec_type: string }) => s.codec_type === "video"
          );

          if (!videoStream) {
            reject(new Error("No video stream found"));
            return;
          }

          const width = videoStream.width;
          const height = videoStream.height;
          const codec = videoStream.codec_name;
          const fps =
            this.parseFps(videoStream.r_frame_rate) ||
            this.parseFps(videoStream.avg_frame_rate) ||
            30;

          resolve({ width, height, fps, codec });
        } catch (parseError) {
          reject(new Error(`Failed to parse probe output: ${parseError}`));
        }
      });

      this.probeProcess.on("error", (err) => {
        clearTimeout(timeoutId);
        this.probeProcess = null;
        if (!killed) {
          reject(err);
        }
      });
    });
  }

  /**
   * Build FFprobe arguments based on protocol
   */
  private buildFfprobeArgs(streamUrl: string, timeout: number): string[] {
    const baseArgs = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_streams",
    ];

    const url = streamUrl.toLowerCase();

    if (url.startsWith("rtsp://") || url.startsWith("rtsps://")) {
      return [
        ...baseArgs,
        "-rtsp_transport",
        "tcp",
        "-timeout",
        `${timeout * 1000000}`,
        streamUrl,
      ];
    } else if (url.startsWith("udp://")) {
      return [
        ...baseArgs,
        "-fifo_size",
        "5000000",
        "-overrun_nonfatal",
        "1",
        "-analyzeduration",
        "5000000",
        "-probesize",
        "5000000",
        streamUrl,
      ];
    }

    return [...baseArgs, streamUrl];
  }

  /**
   * Cancel any in-progress probe
   */
  private cancelProbe(): void {
    if (this.probeProcess) {
      this.probeProcess.kill("SIGKILL");
      this.probeProcess = null;
    }
  }

  // ==================== STREAM CAPTURE ====================

  /**
   * Start stream capture process
   */
  private async startStreamCapture(): Promise<void> {
    // Calculate effective properties
    const fps = this.streamProperties?.fps ?? DEFAULT_STREAM_FPS;
    const width =
      this.config.targetWidth ??
      this.streamProperties?.width ??
      DEFAULT_STREAM_WIDTH;
    const height =
      this.config.targetHeight ??
      this.streamProperties?.height ??
      DEFAULT_STREAM_HEIGHT;

    const streamConfig: StreamConfig = {
      cameraId: this.config.cameraId,
      cameraName: this.config.cameraName,
      streamUrl: this.config.streamUrl,
      fps,
      width,
      height,
    };

    // Create stream capture (UDP or RTSP based on URL)
    this.streamCapture = await createStreamCapture(streamConfig);

    // Set up frame event listener
    this.streamCapture.on("frame", this.handleFrame.bind(this));
    this.streamCapture.on("error", (err) => {
      console.error(`${this.logPrefix} Stream error:`, err);
    });

    // Start the stream
    await this.streamCapture.start();

    console.log(
      `${this.logPrefix} Stream capture started: ${width}x${height} @ ${fps}fps`
    );
  }

  /**
   * Stop stream capture
   */
  private async stopStreamCapture(): Promise<void> {
    if (this.streamCapture) {
      this.streamCapture.removeAllListeners("frame");
      this.streamCapture.removeAllListeners("error");
      await this.streamCapture.stop();
    }
  }

  // ==================== RECORDER ====================

  /**
   * Start recorder process
   */
  private async startRecorder(): Promise<void> {
    const fps = this.streamProperties?.fps ?? DEFAULT_STREAM_FPS;
    this.recorder = new ContinuousRecorder(this.config.cameraId, fps);
    await this.recorder.start();

    console.log(`${this.logPrefix} Recorder started`);
  }

  /**
   * Stop recorder
   */
  private async stopRecorder(): Promise<void> {
    if (this.recorder) {
      await this.recorder.stop();
    }
  }

  // ==================== FRAME PROCESSING ====================

  /**
   * Handle incoming frames from stream capture
   * Frames arrive as JPEG (from FFmpeg MJPEG output) - no compression needed
   */
  private async handleFrame(frameData: FrameData): Promise<void> {
    const startTime = Date.now();
    this.frameCount++;

    // Update frame flow monitoring
    const previousState = this.frameFlowState;
    const previousTime = this.lastFrameTime;
    this.lastFrameTime = startTime;

    // Reset to healthy if recovering
    if (previousState !== "healthy") {
      this.frameFlowState = "healthy";
      await this.emitFrameFlowRecovery(previousState, previousTime);
    }

    try {
      // Frame is already JPEG from FFmpeg - no compression needed!
      const jpegBuffer = frameData.frame;

      // 1. Emit to Socket.IO clients
      emitFrame(this.config.cameraId, jpegBuffer, frameData.timestamp);

      // 2. Write to recorder
      this.recorder?.writeFrame(jpegBuffer);

      // 3. Publish to Redis Streams for motion detection (if enabled)
      if (this.config.motionDetectionEnabled) {
        await this.publishFrameToRedis(jpegBuffer, frameData.timestamp);
      }

      // Track performance (now minimal since no Sharp compression)
      const processingTime = Date.now() - startTime;
      this.trackPerformance(processingTime);

      // Log and emit stats every 100 frames
      if (this.frameCount % 100 === 0) {
        const avgProcessing = this.getAverageProcessingTime();
        const fps = this.getCurrentFPS();
        const jpegSizeMB = jpegBuffer.length / 1024 / 1024;

        // Get FFmpeg timing metrics from stream capture and recorder
        const decodeMs = this.streamCapture?.getAverageDecodeMs() ?? 0;
        const encodeMs = this.recorder?.getAverageEncodeMs() ?? 0;
        const decoder = getCameraDecoder(this.config.cameraId);
        const encoder = getCameraEncoder(this.config.cameraId);

        console.log(
          `${this.logPrefix} Frame ${this.frameCount} | ` +
            `FPS: ${fps.toFixed(1)} | Proc: ${avgProcessing.toFixed(1)}ms | ` +
            `Dec: ${decodeMs.toFixed(1)}ms | Enc: ${encodeMs.toFixed(1)}ms | ` +
            `JPEG: ${(jpegBuffer.length / 1024).toFixed(1)}KB`
        );

        // Emit stats to subscribed clients
        emitStats({
          cameraId: this.config.cameraId,
          cameraName: this.config.cameraName,
          state: this._state,
          frameCount: this.frameCount,
          fps,
          avgProcessingMs: avgProcessing,
          jpegQuality: 95, // Fixed quality from FFmpeg -q:v 2
          jpegSizeMB,
          frameFlowState: this.frameFlowState,
          motionProcessingMs: this.getAverageMotionProcessingTime(),
          decodeMs,
          encodeMs,
          decoderType: decoder?.name ?? "software",
          encoderType: encoder?.name ?? "libx264",
        });
      }
    } catch (error) {
      console.error(`${this.logPrefix} Error processing frame:`, error);
    }
  }

  /**
   * Publish frame to Redis Streams for motion detection
   */
  private async publishFrameToRedis(
    jpegBuffer: Buffer,
    timestamp: number
  ): Promise<void> {
    try {
      const streamKey = `camera:${this.config.cameraId}:frames`;

      await redis.xAdd(
        streamKey,
        "*",
        {
          image: jpegBuffer,
          timestamp: timestamp.toString(),
        },
        {
          TRIM: {
            strategy: "MAXLEN",
            strategyModifier: "~",
            threshold: 30,
          },
        }
      );
    } catch (error) {
      console.error(`${this.logPrefix} Failed to publish to Redis:`, error);
    }
  }

  // ==================== MOTION DETECTION SUBSCRIPTION ====================

  /**
   * Subscribe to motion detection results from Redis pub/sub
   */
  private async subscribeToMotionResults(): Promise<void> {
    if (!this.config.motionDetectionEnabled) return;

    try {
      this.motionSubscriber = createClient({
        url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
      });

      await this.motionSubscriber.connect();

      const channel = `motion:${this.config.cameraId}`;
      await this.motionSubscriber.subscribe(channel, (message) => {
        try {
          const data: MotionDetectionResult = JSON.parse(message);
          if (data.processing_time_ms !== undefined) {
            this.motionProcessingTimes.add(data.processing_time_ms);
          }
        } catch {
          // Ignore parse errors
        }
      });

      console.log(`${this.logPrefix} Subscribed to motion detection results`);
    } catch (error) {
      console.error(`${this.logPrefix} Failed to subscribe to motion results:`, error);
    }
  }

  /**
   * Unsubscribe from motion detection results
   */
  private async unsubscribeFromMotionResults(): Promise<void> {
    if (this.motionSubscriber) {
      try {
        await this.motionSubscriber.unsubscribe();
        await this.motionSubscriber.quit();
      } catch {
        // Ignore errors during cleanup
      }
      this.motionSubscriber = null;
    }
  }

  /**
   * Get average motion processing time (rolling average, not cleared)
   */
  private getAverageMotionProcessingTime(): number | null {
    const count = this.motionProcessingTimes.getCount();
    if (count === 0) return null;
    return this.motionProcessingTimes.getAverage();
  }

  // ==================== FRAME FLOW MONITORING ====================

  /**
   * Start frame flow health monitoring
   */
  private startFrameFlowMonitoring(): void {
    this.frameFlowCheckInterval = setInterval(() => {
      this.checkFrameFlow();
    }, 2000);
  }

  /**
   * Stop frame flow monitoring
   */
  private stopFrameFlowMonitoring(): void {
    if (this.frameFlowCheckInterval) {
      clearInterval(this.frameFlowCheckInterval);
      this.frameFlowCheckInterval = null;
    }
  }

  /**
   * Check frame flow and escalate if needed
   */
  private async checkFrameFlow(): Promise<void> {
    if (this._state !== "running") return;

    const now = Date.now();
    const timeSinceLastFrame = now - this.lastFrameTime;

    if (timeSinceLastFrame >= 10000 && this.frameFlowState !== "critical") {
      this.frameFlowState = "critical";
      await this.emitFrameFlowCritical();
      this.requestRestart();
    } else if (
      timeSinceLastFrame >= 5000 &&
      this.frameFlowState === "healthy"
    ) {
      this.frameFlowState = "warning";
      await this.emitFrameFlowWarning();
    }
  }

  /**
   * Request a restart from StreamManager
   *
   * CameraController does NOT restart itself - it signals to StreamManager
   * that a restart is needed. StreamManager owns the RestartTracker and
   * handles the actual restart lifecycle to avoid race conditions.
   */
  private requestRestart(): void {
    if (this.isDisposed) return;

    // Debounce: don't request multiple restarts within 5 seconds
    const now = Date.now();
    if (now - this.restartRequestedAt < 5000) {
      console.log(`${this.logPrefix} Restart already requested, skipping duplicate`);
      return;
    }
    this.restartRequestedAt = now;

    console.log(`${this.logPrefix} Requesting restart from StreamManager...`);
    this.emit("restartNeeded", { cameraId: this.config.cameraId, cameraName: this.config.cameraName });
  }

  // ==================== EVENT EMISSION ====================

  private async emitFrameFlowWarning(): Promise<void> {
    console.warn(`${this.logPrefix} No frames for 5 seconds`);

    await raiseEvent({
      type: "warning",
      message: `Camera "${this.config.cameraName}" has not sent frames for 5 seconds`,
      system: "cameraIngestion:frameFlow",
    });
  }

  private async emitFrameFlowCritical(): Promise<void> {
    console.error(
      `${this.logPrefix} No frames for 10 seconds, restarting...`
    );

    await raiseEvent({
      type: "warning",
      message: `Camera "${this.config.cameraName}" has not sent frames for 10 seconds, attempting restart`,
      system: "cameraIngestion:frameFlow",
    });
  }

  private async emitFrameFlowRecovery(
    previousState: "warning" | "critical",
    time: number
  ): Promise<void> {
    const downtimeMs = this.lastFrameTime - time;
    const downtimeHuman = ms(downtimeMs, { long: true });

    console.log(
      `${this.logPrefix} Frame flow recovered from ${previousState}`
    );

    await raiseEvent({
      type: "info",
      message: `Camera "${this.config.cameraName}" recovered after ${downtimeHuman}`,
      system: "cameraIngestion:frameFlow",
    });
  }

  // ==================== UTILITIES ====================

  private parseFps(frameRate: string | undefined): number | null {
    if (!frameRate) return null;
    const [num, den] = frameRate.split("/").map(Number);
    return num && den && den !== 0 ? Math.round(num / den) : null;
  }

  private trackPerformance(processingTime: number): void {
    this.frameProcessingTimes.add(processingTime);
  }

  private getAverageProcessingTime(): number {
    return this.frameProcessingTimes.getAverage();
  }

  private getCurrentFPS(): number {
    const count = this.frameProcessingTimes.getCount();
    if (count < 2) return 0;
    const recentFrames = Math.min(30, count);
    const recentTimes = this.frameProcessingTimes.getRecent(recentFrames);
    const timeWindow = recentTimes.reduce((a, b) => a + b, 0);
    return (recentFrames / timeWindow) * 1000;
  }

  private maskStreamUrl(url: string): string {
    return url.replace(/rtsp:\/\/([^:]+):([^@]+)@/gi, "rtsp://***:***@");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== PUBLIC GETTERS ====================

  public getCameraId(): string {
    return this.config.cameraId;
  }

  public getCameraName(): string {
    return this.config.cameraName;
  }

  public getFrameCount(): number {
    return this.frameCount;
  }

  public running(): boolean {
    return this._state === "running";
  }
}
