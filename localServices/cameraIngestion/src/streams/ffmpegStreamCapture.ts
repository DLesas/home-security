import { FFmpegProcess } from "./ffmpegProcess";
import { StreamCapture, StreamConfig, FrameData } from "./streamInterface";

/**
 * Base class for FFmpeg-based stream capture
 * Extends FFmpegProcess to add frame buffering and emission logic
 *
 * Subclasses should override:
 * - buildFFmpegArgs(): Provide protocol-specific FFmpeg arguments
 * - getReconnectDelay(): Optional custom reconnection logic
 * - maskSensitiveData(): Optional credential/sensitive data masking
 */
export abstract class FFmpegStreamCapture extends StreamCapture {
  private ffmpegProcess: FFmpegProcess;
  private frameBuffer: Buffer = Buffer.alloc(0);
  private frameSize: number;

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
   * Build FFmpeg arguments for this stream type
   * Must be implemented by subclasses
   */
  protected abstract buildFFmpegArgs(): string[];

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
   */
  private handleFrameData(chunk: Buffer): void {
    this.frameBuffer = Buffer.concat([this.frameBuffer, chunk]);

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
    }
  }

  async start(): Promise<void> {
    return this.ffmpegProcess.start();
  }

  async stop(): Promise<void> {
    this.frameBuffer = Buffer.alloc(0); // Clear frame buffer
    return this.ffmpegProcess.stop();
  }
}
