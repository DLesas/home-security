import sharp from "sharp";
import ms from "ms";
import { StreamCapture, FrameData } from "./streams/streamInterface";
import { emitFrame } from "./socketHandler";
import {
  JPEG_QUALITY_MIN,
  JPEG_QUALITY_MAX,
  AI_SAMPLING_RATE,
  CPU_THRESHOLD_HIGH,
  CPU_THRESHOLD_LOW,
  DEFAULT_STREAM_FPS,
} from "./config";
import { cpuMonitor } from "./cpuMonitor";
import { ContinuousRecorder } from "./recording/continuousRecorder";
import { raiseEvent } from "./shared/events/notify";

/**
 * FrameGrabber orchestrates frame capture, compression, and distribution
 *
 * Responsibilities:
 * 1. Listen to StreamCapture "frame" events
 * 2. Compress raw RGB24 frames to JPEG
 * 3. Emit compressed frames via Socket.IO to all clients (30 FPS)
 * 4. Sample frames for AI processing (configurable rate, e.g., every 3rd frame = 10 FPS)
 * 5. Pass frames to recorder for continuous recording
 *
 * Data Flow:
 * StreamCapture → FrameGrabber → [Socket.IO, AI Queue, Recorder]
 */
export class FrameGrabber {
  private streamCapture: StreamCapture;
  private frameCount: number = 0;
  private aiSamplingRate: number;
  private currentJpegQuality: number;
  private isRunning: boolean = false;
  private recorder: ContinuousRecorder;

  // Performance metrics
  private frameProcessingTimes: number[] = [];
  private lastQualityAdjustment: number = 0;

  // Frame flow health monitoring
  private lastFrameTime: number = 0;
  private frameFlowState: 'healthy' | 'warning' | 'critical' = 'healthy';
  private frameFlowCheckInterval: NodeJS.Timeout | null = null;

  constructor(streamCapture: StreamCapture, aiSamplingRate?: number) {
    this.streamCapture = streamCapture;
    this.aiSamplingRate = aiSamplingRate || AI_SAMPLING_RATE;
    this.currentJpegQuality = JPEG_QUALITY_MAX; // Start at max quality

    // Create recorder for continuous recording
    // FFmpeg's fps filter handles CFR (duplicates/drops frames automatically)
    this.recorder = new ContinuousRecorder(
      this.streamCapture.getCameraId(),
      DEFAULT_STREAM_FPS
    );
  }

  /**
   * Start grabbing and processing frames
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn(
        `[FrameGrabber ${this.streamCapture.getCameraId()}] Already running`
      );
      return;
    }

    console.log(
      `[FrameGrabber ${this.streamCapture.getCameraId()}] Starting frame grabber`
    );

    // Set up frame event listener
    this.streamCapture.on("frame", this.handleFrame.bind(this));

    // Set up error event listener
    this.streamCapture.on("error", (err) => {
      console.error(
        `[FrameGrabber ${this.streamCapture.getCameraId()}] Stream error:`,
        err
      );
    });

    // Start the stream capture
    await this.streamCapture.start();

    // Start the recorder (FFmpeg fps filter handles CFR)
    await this.recorder.start();

    // Start frame flow health monitoring
    this.lastFrameTime = Date.now();
    this.frameFlowState = 'healthy';
    this.startFrameFlowMonitoring();

    this.isRunning = true;
    console.log(
      `[FrameGrabber ${this.streamCapture.getCameraId()}] Started successfully`
    );
  }

  /**
   * Stop grabbing frames and cleanup
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn(
        `[FrameGrabber ${this.streamCapture.getCameraId()}] Not running`
      );
      return;
    }

    console.log(
      `[FrameGrabber ${this.streamCapture.getCameraId()}] Stopping frame grabber`
    );

    // Stop frame flow monitoring
    if (this.frameFlowCheckInterval) {
      clearInterval(this.frameFlowCheckInterval);
      this.frameFlowCheckInterval = null;
    }

    // Remove all listeners
    this.streamCapture.removeAllListeners("frame");
    this.streamCapture.removeAllListeners("error");

    // Stop the stream capture
    await this.streamCapture.stop();

    // Stop the recorder
    await this.recorder.stop();

    this.isRunning = false;
    this.frameCount = 0;
  }

  /**
   * Handle incoming raw frames from StreamCapture
   */
  private async handleFrame(frameData: FrameData): Promise<void> {
    const startTime = Date.now();
    this.frameCount++;

    // Update frame flow monitoring
    const previousState = this.frameFlowState;
    const previousTime = this.lastFrameTime;
    this.lastFrameTime = startTime;

    // Reset to healthy if we were in warning/critical state
    if (previousState !== 'healthy') {
      this.frameFlowState = 'healthy';
      await this.emitFrameFlowRecovery(previousState, previousTime);
    }

    try {
      const cameraId = this.streamCapture.getCameraId();

      // Compress raw RGB24 frame to JPEG
      const jpegBuffer = await this.compressFrame(frameData);

      // 1. Emit to Socket.IO clients subscribed to this camera
      emitFrame(cameraId, jpegBuffer, frameData.timestamp);

      // 2. Write JPEG to recorder (FFmpeg fps filter maintains CFR)
      this.recorder.writeFrame(jpegBuffer);

      // 3. Sample frames for AI processing (every Nth frame)
      if (this.frameCount % this.aiSamplingRate === 0) {
        // TODO: Push to AI queue (Redis Streams or direct API call)
        // await this.sendToAI(cameraId, jpegBuffer, frameData.timestamp);
      }

      // Track performance
      const processingTime = Date.now() - startTime;
      this.trackPerformance(processingTime);

      // Log frame info every 100 frames
      if (this.frameCount % 100 === 0) {
        const avgProcessing = this.getAverageProcessingTime();
        const fps = this.getCurrentFPS();
        console.log(
          `[FrameGrabber ${cameraId}, ${this.streamCapture.getCameraName()}] Frame ${this.frameCount} | ` +
          `FPS: ${fps.toFixed(1)} | ` +
          `Avg Processing: ${avgProcessing.toFixed(2)}ms | ` +
          `JPEG Size: ${(jpegBuffer.length / 1024).toFixed(1)}KB`
        );
      }
    } catch (error) {
      console.error(
        `[FrameGrabber ${this.streamCapture.getCameraId()}] Error processing frame ${this.frameCount}:`,
        error
      );
    }
  }

  /**
   * Get adaptive JPEG quality based on current CPU usage
   * Adjusts quality to maintain system performance
   */
  private getAdaptiveQuality(): number {
    const now = Date.now();

    // Only adjust quality every 5 seconds to avoid rapid changes
    if (now - this.lastQualityAdjustment < 5000) {
      return this.currentJpegQuality;
    }

    const cpuUsage = cpuMonitor.getCPUUsage();

    // Adjust quality based on CPU usage
    if (cpuUsage > CPU_THRESHOLD_HIGH) {
      // High CPU - reduce quality
      this.currentJpegQuality = Math.max(
        JPEG_QUALITY_MIN,
        this.currentJpegQuality - 10
      );
      console.log(
        `[FrameGrabber ${this.streamCapture.getCameraId()}] ⚠️ High CPU ${cpuUsage.toFixed(1)}% - reducing quality to ${this.currentJpegQuality}`
      );
    } else if (cpuUsage < CPU_THRESHOLD_LOW) {
      // Low CPU - increase quality
      this.currentJpegQuality = Math.min(
        JPEG_QUALITY_MAX,
        this.currentJpegQuality + 5
      );
      if (this.currentJpegQuality === JPEG_QUALITY_MAX) {
        // Only log when reaching max
        console.log(
          `[FrameGrabber ${this.streamCapture.getCameraId()}] ✓ Low CPU ${cpuUsage.toFixed(1)}% - quality at maximum ${this.currentJpegQuality}`
        );
      }
    }

    this.lastQualityAdjustment = now;
    return this.currentJpegQuality;
  }

  /**
   * Compress raw RGB24 frame to JPEG using sharp with adaptive quality
   */
  private async compressFrame(frameData: FrameData): Promise<Buffer> {
    const { frame, width, height } = frameData;

    // Default to 720p if dimensions not specified (better performance)
    const frameWidth = width || 1280;
    const frameHeight = height || 720;

    // Get adaptive quality based on CPU load
    const quality = this.getAdaptiveQuality();

    // Use sharp to convert RGB24 raw buffer to JPEG
    const jpegBuffer = await sharp(frame, {
      raw: {
        width: frameWidth,
        height: frameHeight,
        channels: 3, // RGB = 3 channels
      },
    })
      .jpeg({
        quality,
        chromaSubsampling: "4:2:0", // Standard subsampling for better compression
      })
      .toBuffer();

    return jpegBuffer;
  }

  /**
   * Track frame processing performance
   */
  private trackPerformance(processingTime: number): void {
    this.frameProcessingTimes.push(processingTime);

    // Keep only last 100 samples
    if (this.frameProcessingTimes.length > 100) {
      this.frameProcessingTimes.shift();
    }
  }

  /**
   * Get average processing time over last 100 frames
   */
  private getAverageProcessingTime(): number {
    if (this.frameProcessingTimes.length === 0) return 0;

    const sum = this.frameProcessingTimes.reduce((a, b) => a + b, 0);
    return sum / this.frameProcessingTimes.length;
  }

  /**
   * Calculate current FPS based on frame timestamps
   */
  private getCurrentFPS(): number {
    if (this.frameProcessingTimes.length < 2) return 0;

    const recentFrames = Math.min(30, this.frameProcessingTimes.length);
    const timeWindow = this.frameProcessingTimes
      .slice(-recentFrames)
      .reduce((a, b) => a + b, 0);

    return (recentFrames / timeWindow) * 1000;
  }

  /**
   * Check if frame grabber is running
   */
  public running(): boolean {
    return this.isRunning;
  }

  /**
   * Get current frame count
   */
  public getFrameCount(): number {
    return this.frameCount;
  }

  /**
   * Get camera ID
   */
  public getCameraId(): string {
    return this.streamCapture.getCameraId();
  }

  /**
   * Start frame flow health monitoring
   * Checks every 2 seconds for frame flow issues
   */
  private startFrameFlowMonitoring(): void {
    this.frameFlowCheckInterval = setInterval(() => {
      this.checkFrameFlow();
    }, 2000); // Check every 2 seconds
  }

  /**
   * Check frame flow and escalate if needed
   * State transitions:
   * - healthy → warning (5s no frames)
   * - warning → critical (10s no frames)
   * - warning/critical → healthy (frames resume)
   */
  private async checkFrameFlow(): Promise<void> {
    const now = Date.now();
    const timeSinceLastFrame = now - this.lastFrameTime;

    if (timeSinceLastFrame >= 10000 && this.frameFlowState !== 'critical') {
      // 10+ seconds without frames - CRITICAL
      this.frameFlowState = 'critical';
      await this.emitFrameFlowCritical();
      await this.restartStream();
    } else if (timeSinceLastFrame >= 5000 && this.frameFlowState === 'healthy') {
      // 5-10 seconds without frames - WARNING
      this.frameFlowState = 'warning';
      await this.emitFrameFlowWarning();
    }
  }

  /**
   * Emit warning event when frames stop for 5 seconds
   */
  private async emitFrameFlowWarning(): Promise<void> {
    const cameraId = this.streamCapture.getCameraId();
    const cameraName = this.streamCapture.getCameraName();
    console.warn(
      `[FrameGrabber ${cameraId}, ${cameraName}] ⚠️ WARNING: No frames received for 5 seconds`
    );

    await raiseEvent({
      type: 'warning',
      message: `System has not recieved frames from camera "${cameraName}" with id ${cameraId} for over 5 seconds.`,
      system: 'cameraIngestion:frameFlow'
    });
  }

  /**
   * Emit critical event when frames stop for 10 seconds
   */
  private async emitFrameFlowCritical(): Promise<void> {
    const cameraId = this.streamCapture.getCameraId();
    const cameraName = this.streamCapture.getCameraName();
    console.error(
      `[FrameGrabber ${cameraId}, ${cameraName}] ⚠️ WARNING: No frames received for over 10 seconds, restarting stream...`
    );

    await raiseEvent({
      type: 'warning',
      message: `System has not recieved frames from camera "${cameraName}" with id ${cameraId} for over 10 seconds... attempting to restart the stream.`,
      system: 'cameraIngestion:frameFlow'
    });
  }

  /**
   * Emit recovery event when frames resume after warning/critical state
   */
  private async emitFrameFlowRecovery(previousState: 'warning' | 'critical', time: number): Promise<void> {
    const cameraId = this.streamCapture.getCameraId();
    const cameraName = this.streamCapture.getCameraName();
    const downtimeMs = this.lastFrameTime - time;
    const downtimeHuman = ms(downtimeMs, { long: true });

    console.log(
      `[FrameGrabber ${cameraId}, ${cameraName}] ✓ Frame flow recovered from ${previousState} state`
    );

    await raiseEvent({
      type: 'info',
      message: `Camera "${cameraName}" has recovered and is now sending frames again after being offline for ${downtimeHuman}.`,
      system: 'cameraIngestion:frameFlow',
    });
  }

  /**
   * Restart the stream when frame flow is critical
   */
  private async restartStream(): Promise<void> {
    const cameraId = this.streamCapture.getCameraId();
    const cameraName = this.streamCapture.getCameraName();
    console.log(`[FrameGrabber ${cameraId}] Restarting stream due to frame flow failure...`);

    try {
      // Stop everything
      await this.stop();

      // Wait a moment before restarting
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Restart everything
      await this.start();

      console.log(`[FrameGrabber ${cameraId}] Stream restarted successfully`);
    } catch (error) {
      console.error(
        `[FrameGrabber ${cameraId}] Failed to restart stream:`,
        error
      );

      await raiseEvent({
        type: 'critical',
        message: `Camera "${cameraName}" stream failed to restart after not receiving frames for over 10 seconds...please investigate the camera.`,
        system: 'cameraIngestion:frameFlow'
      });
    }
  }
}
