import { FFmpegProcess } from "./ffmpegProcess";
import { StreamCapture, StreamConfig, FrameData } from "./streamInterface";

/**
 * Base class for FFmpeg-based stream capture
 * Handles frame buffering, emission, and common FFmpeg pipeline configuration
 *
 * Note: Stream probing is now handled by CameraController, not by StreamCapture classes.
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
  private frameSize: number;
  private bufferWarningLogged: boolean = false;

  constructor(config: StreamConfig) {
    super(config);

    // Calculate frame size (RGB24 = 3 bytes per pixel)
    this.frameSize =
      (this.config.width || 1920) *
      (this.config.height || 1080) *
      3;

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
   * Used by all stream types for consistent raw frame output
   */
  protected buildCommonOutputArgs(): string[] {
    return [
      "-f", "image2pipe",               // Output as image stream
      "-pix_fmt", "rgb24",              // RGB24 pixel format
      "-vcodec", "rawvideo",            // Raw video output
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
   * Combines protocol-specific input args with common output args
   *
   * Subclasses typically only need to implement buildProtocolSpecificInputArgs()
   * Override this method entirely for completely custom FFmpeg pipelines
   */
  protected buildFFmpegArgs(): string[] {
    return [
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
   * Buffers chunks until complete frame is received
   *
   * Note: FFmpeg/pipe backpressure naturally throttles if we can't keep up.
   * Buffer should only hold partial frame data (< frameSize). If it grows
   * beyond 2x frameSize, something is wrong (frameSize mismatch or FFmpeg issue).
   */
  private handleFrameData(chunk: Buffer): void {
    this.frameBuffer = Buffer.concat([this.frameBuffer, chunk]);

    // Safety check: warn if buffer grows unexpectedly large
    if (this.frameBuffer.length > this.frameSize * 2 && !this.bufferWarningLogged) {
      console.warn(
        `${this.getLogPrefix()} Buffer unexpectedly large: ${(this.frameBuffer.length / 1024 / 1024).toFixed(1)}MB ` +
        `(expected max ~${(this.frameSize / 1024 / 1024).toFixed(1)}MB). Possible frameSize mismatch.`
      );
      this.bufferWarningLogged = true;
    }

    // Emit complete frames
    while (this.frameBuffer.length >= this.frameSize) {
      const frame = this.frameBuffer.subarray(0, this.frameSize);
      this.frameBuffer = this.frameBuffer.subarray(this.frameSize);

      const frameData: FrameData = {
        frame: Buffer.from(frame), // Create new buffer from subarray
        timestamp: Date.now(),
        width: this.config.width,
        height: this.config.height,
      };

      this.emit("frame", frameData);

      // Reset warning flag once we successfully extract a frame
      this.bufferWarningLogged = false;
    }
  }

  async start(): Promise<void> {
    return this.ffmpegProcess.start();
  }

  async stop(): Promise<void> {
    this.frameBuffer = Buffer.alloc(0); // Clear frame buffer
    return this.ffmpegProcess.stop();
  }

  async dispose(): Promise<void> {
    this.frameBuffer = Buffer.alloc(0); // Clear frame buffer
    return this.ffmpegProcess.dispose();
  }

  /**
   * Override updateConfig to recalculate frameSize when resolution changes
   */
  public updateConfig(newConfig: Partial<StreamConfig>): void {
    super.updateConfig(newConfig);

    // Recalculate frame size if resolution changed (RGB24 = 3 bytes per pixel)
    this.frameSize =
      (this.config.width || 1920) *
      (this.config.height || 1080) *
      3;

    // Clear frame buffer since frameSize may have changed
    this.frameBuffer = Buffer.alloc(0);
  }
}
