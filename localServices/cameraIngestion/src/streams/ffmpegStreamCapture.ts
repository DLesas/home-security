import { FFmpegProcess } from "./ffmpegProcess";
import { StreamCapture, StreamConfig, FrameData } from "./streamInterface";
import {
  assignDecoder,
  getDecoderArgs,
  releaseDecoder,
  onNvdecFailure,
  isNvdecFailure,
  getCameraDecoder,
} from "../utils/hardwareDecoder";
import { RollingAverage } from "../utils/rollingAverage";

// JPEG markers for frame boundary detection
const JPEG_SOI = Buffer.from([0xff, 0xd8]); // Start of Image
const JPEG_EOI = Buffer.from([0xff, 0xd9]); // End of Image

/**
 * Base class for FFmpeg-based stream capture
 * Handles frame buffering, emission, and common FFmpeg pipeline configuration
 *
 * Note: Stream probing is now handled by CameraController, not by StreamCapture classes.
 * Output format: MJPEG (JPEG frames) for efficient streaming and recording.
 *
 * Subclasses must implement:
 * - buildProtocolSpecificInputArgs(): Protocol-specific FFmpeg input flags
 * - getLogPrefix(): Log prefix for consistent logging (e.g., "[RTSPStreamCapture]")
 *
 * Subclasses may override:
 * - buildFFmpegArgs(): Override for completely custom FFmpeg pipelines
 * - getReconnectDelay(): Custom reconnection strategy
 * - maskSensitiveData(): Credential masking for secure logging
 */
export abstract class FFmpegStreamCapture extends StreamCapture {
  private ffmpegProcess: FFmpegProcess;
  private frameBuffer: Buffer = Buffer.alloc(0);
  private bufferWarningLogged: boolean = false;

  // Decode timing metrics (frame-to-frame interval)
  private decodeMetrics = new RollingAverage(100);
  private lastFrameEmitTime: number = 0;

  constructor(config: StreamConfig) {
    super(config);

    // Assign decoder for this camera (handles NVDEC slot tracking)
    assignDecoder(config.cameraId);

    // Create FFmpeg process wrapper
    this.ffmpegProcess = new (class extends FFmpegProcess {
      constructor(
        processId: string,
        private parent: FFmpegStreamCapture
      ) {
        super(processId);
      }

      protected buildFFmpegArgs(): string[] {
        return this.parent.buildFFmpegArgs();
      }

      protected getReconnectDelay(): number | null {
        return this.parent.getReconnectDelay();
      }

      protected maskSensitiveData(text: string): string {
        return this.parent.maskSensitiveData(text);
      }

      protected handleStdout(chunk: Buffer): void {
        this.parent.handleFrameData(chunk);
      }
    })(config.cameraId, this);

    // Handle NVDEC failures before restart
    this.ffmpegProcess.on("beforeRestart", (stderrData: string) => {
      const decoder = getCameraDecoder(config.cameraId);
      if (decoder?.name === "nvdec" && isNvdecFailure(stderrData)) {
        onNvdecFailure(config.cameraId);
      }
    });

    // Forward events from FFmpeg process to stream
    this.ffmpegProcess.on("started", () => {
      this.isRunning = true;
      this.emit("started");
    });

    this.ffmpegProcess.on("stopped", () => {
      this.isRunning = false;
      this.emit("stopped");
    });

    this.ffmpegProcess.on("error", (err) => {
      this.emit("error", err);
    });
  }

  /**
   * Build protocol-specific FFmpeg input arguments
   * Must be implemented by subclasses (e.g., RTSP transport flags, UDP buffer settings)
   *
   * @returns Array of FFmpeg input options (before -i)
   */
  protected abstract buildProtocolSpecificInputArgs(): string[];

  /**
   * Build common FFmpeg output arguments
   * Outputs MJPEG (JPEG frames) for efficient streaming and recording
   * Quality: -q:v 2 = best quality (2=best, 31=worst)
   */
  protected buildCommonOutputArgs(): string[] {
    return [
      "-f", "image2pipe",               // Output as image stream
      "-pix_fmt", "yuvj420p",           // JPEG-compatible pixel format
      "-vcodec", "mjpeg",               // MJPEG encoder
      "-q:v", "2",                      // Quality (2=best, 31=worst)
      "-r", `${this.config.fps || 30}`, // Frame rate
    ];
  }

  /**
   * Build resolution arguments if target resolution is specified
   */
  protected buildResolutionArgs(): string[] {
    if (this.config.width && this.config.height) {
      return ["-s", `${this.config.width}x${this.config.height}`];
    }
    return [];
  }

  /**
   * Build complete FFmpeg arguments using template method pattern
   * Combines hardware decoder args, protocol-specific input args, and output args
   *
   * Subclasses typically only need to implement buildProtocolSpecificInputArgs()
   * Override this method entirely for completely custom FFmpeg pipelines
   */
  protected buildFFmpegArgs(): string[] {
    return [
      ...getDecoderArgs(this.config.cameraId), // Hardware decoder (must be before -i)
      ...this.buildProtocolSpecificInputArgs(),
      "-i", this.config.streamUrl,
      ...this.buildCommonOutputArgs(),
      ...this.buildResolutionArgs(),
      "pipe:1",
    ];
  }

  /**
   * Get the log prefix for this stream type (e.g., "[RTSPStreamCapture]")
   * Used for consistent logging
   */
  protected abstract getLogPrefix(): string;

  /**
   * Get reconnect delay in milliseconds based on attempt number
   * Override in subclass for custom reconnection strategy
   */
  protected getReconnectDelay(): number | null {
    // Default: simple 5 second delay, infinite retries
    return 5000;
  }

  /**
   * Mask sensitive data in logs (e.g., credentials in URLs)
   * Override in subclass if needed
   */
  protected maskSensitiveData(text: string): string {
    return text;
  }

  /**
   * Handle frame data from FFmpeg stdout
   * Detects JPEG frame boundaries using SOI (0xFFD8) and EOI (0xFFD9) markers
   *
   * Note: FFmpeg/pipe backpressure naturally throttles if we can't keep up.
   * Buffer should only hold partial JPEG data (typically < 200KB per frame).
   * If it grows beyond 2MB, something is wrong.
   */
  private handleFrameData(chunk: Buffer): void {
    this.frameBuffer = Buffer.concat([this.frameBuffer, chunk]);

    // Safety check: warn if buffer grows unexpectedly large (> 2MB)
    if (this.frameBuffer.length > 2 * 1024 * 1024 && !this.bufferWarningLogged) {
      console.warn(
        `${this.getLogPrefix()} Buffer unexpectedly large: ${(this.frameBuffer.length / 1024 / 1024).toFixed(1)}MB. ` +
        `Possible JPEG parsing issue or corrupted stream.`
      );
      this.bufferWarningLogged = true;
    }

    // Extract complete JPEG frames using SOI/EOI markers
    while (true) {
      // Find SOI marker (Start of Image: 0xFFD8)
      const soiIndex = this.findMarker(this.frameBuffer, JPEG_SOI);
      if (soiIndex === -1) {
        // No valid start found, clear buffer
        this.frameBuffer = Buffer.alloc(0);
        break;
      }

      // Trim anything before SOI
      if (soiIndex > 0) {
        this.frameBuffer = this.frameBuffer.subarray(soiIndex);
      }

      // Find EOI marker (End of Image: 0xFFD9) starting after SOI
      const eoiIndex = this.findMarker(this.frameBuffer, JPEG_EOI, 2);
      if (eoiIndex === -1) {
        // Incomplete frame, wait for more data
        break;
      }

      // Extract complete JPEG frame (including EOI marker)
      const frameEnd = eoiIndex + 2;
      const jpegFrame = Buffer.from(this.frameBuffer.subarray(0, frameEnd));
      this.frameBuffer = this.frameBuffer.subarray(frameEnd);

      const now = Date.now();
      const frameData: FrameData = {
        frame: jpegFrame,
        timestamp: now,
        width: this.config.width,
        height: this.config.height,
      };

      // Track decode timing (frame-to-frame interval)
      if (this.lastFrameEmitTime > 0) {
        this.decodeMetrics.add(now - this.lastFrameEmitTime);
      }
      this.lastFrameEmitTime = now;

      this.emit("frame", frameData);

      // Reset warning flag once we successfully extract a frame
      this.bufferWarningLogged = false;
    }
  }

  /**
   * Find a 2-byte marker in buffer
   * @param buffer Buffer to search
   * @param marker 2-byte marker to find
   * @param startOffset Starting position (default 0)
   * @returns Index of marker or -1 if not found
   */
  private findMarker(buffer: Buffer, marker: Buffer, startOffset = 0): number {
    for (let i = startOffset; i <= buffer.length - 2; i++) {
      if (buffer[i] === marker[0] && buffer[i + 1] === marker[1]) {
        return i;
      }
    }
    return -1;
  }

  async start(): Promise<void> {
    return this.ffmpegProcess.start();
  }

  async stop(): Promise<void> {
    this.frameBuffer = Buffer.alloc(0); // Clear frame buffer
    this.decodeMetrics.clear();
    this.lastFrameEmitTime = 0;
    return this.ffmpegProcess.stop();
  }

  async dispose(): Promise<void> {
    releaseDecoder(this.config.cameraId); // Free NVDEC slot if applicable
    this.frameBuffer = Buffer.alloc(0);
    this.decodeMetrics.clear();
    this.lastFrameEmitTime = 0;
    return this.ffmpegProcess.dispose();
  }

  /**
   * Override updateConfig to clear buffers when config changes
   */
  public updateConfig(newConfig: Partial<StreamConfig>): void {
    super.updateConfig(newConfig);

    // Clear frame buffer and metrics when config changes
    this.frameBuffer = Buffer.alloc(0);
    this.decodeMetrics.clear();
    this.lastFrameEmitTime = 0;
  }

  /**
   * Get average decode time (frame-to-frame interval in ms)
   * This represents the time between complete frames arriving from FFmpeg
   */
  public getAverageDecodeMs(): number {
    return this.decodeMetrics.getAverage();
  }
}
