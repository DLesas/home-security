import sharp from "sharp";
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

    // Remove all listeners
    this.streamCapture.removeAllListeners("frame");
    this.streamCapture.removeAllListeners("error");

    // Stop the stream capture
    await this.streamCapture.stop();

    // Stop the recorder
    await this.recorder.stop();

    this.isRunning = false;
    this.frameCount = 0;

    console.log(
      `[FrameGrabber ${this.streamCapture.getCameraId()}] Stopped successfully`
    );
  }

  /**
   * Handle incoming raw frames from StreamCapture
   */
  private async handleFrame(frameData: FrameData): Promise<void> {
    const startTime = Date.now();
    this.frameCount++;

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
          `[FrameGrabber ${cameraId}] Frame ${this.frameCount} | ` +
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
}
