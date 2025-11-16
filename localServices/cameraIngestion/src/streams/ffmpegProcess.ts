import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";

/**
 * Base class for managing FFmpeg processes
 * Handles common process lifecycle, error handling, and auto-restart logic
 *
 * Subclasses should override:
 * - buildFFmpegArgs(): Provide FFmpeg arguments
 * - getReconnectDelay(): Optional custom reconnection logic
 * - maskSensitiveData(): Optional credential/sensitive data masking
 * - handleStdout(): Optional stdout data handling
 * - handleStderr(): Optional stderr data handling
 */
export abstract class FFmpegProcess extends EventEmitter {
  protected ffmpegProcess: ChildProcess | null = null;
  protected isRunning: boolean = false;
  protected reconnectAttempts: number = 0;
  protected processId: string;

  constructor(processId: string) {
    super();
    this.processId = processId;
  }

  /**
   * Build FFmpeg arguments for this process
   * Must be implemented by subclasses
   */
  protected abstract buildFFmpegArgs(): string[];

  /**
   * Get reconnect delay in milliseconds based on attempt number
   * Return null to disable reconnection
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
   * Handle stdout data from FFmpeg
   * Override in subclass if needed (e.g., for stream captures)
   */
  protected handleStdout(chunk: Buffer): void {
    // Default: do nothing
  }

  /**
   * Handle stderr data from FFmpeg (logs/errors)
   * Override in subclass for custom logging
   */
  protected handleStderr(chunk: Buffer): void {
    // Default: accumulate for error reporting
  }

  /**
   * Start the FFmpeg process
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn(
        `[FFmpegProcess ${this.processId}] Already running, ignoring start request`
      );
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        console.log(
          `[FFmpegProcess ${this.processId}] Starting FFmpeg process`
        );

        // Build FFmpeg arguments from subclass
        const ffmpegArgs = this.buildFFmpegArgs();

        // Spawn FFmpeg process
        this.ffmpegProcess = spawn("ffmpeg", ffmpegArgs);

        const maskedCommand = this.maskSensitiveData(`ffmpeg ${ffmpegArgs.join(" ")}`);
        console.log(
          `[FFmpegProcess ${this.processId}] FFmpeg started: ${maskedCommand}`
        );

        // Accumulate stderr for error reporting
        let stderrData = "";

        // Handle stdout data
        this.ffmpegProcess.stdout?.on("data", (chunk: Buffer) => {
          this.handleStdout(chunk);
        });

        // Handle stderr (FFmpeg logs)
        this.ffmpegProcess.stderr?.on("data", (chunk: Buffer) => {
          stderrData += chunk.toString();
          this.handleStderr(chunk);
        });

        // Handle process spawn
        this.ffmpegProcess.on("spawn", () => {
          this.isRunning = true;
          this.reconnectAttempts = 0; // Reset on successful start
          this.emit("started");
          resolve();
        });

        // Handle spawn errors
        this.ffmpegProcess.on("error", (err) => {
          const maskedError = this.maskSensitiveData(err.message);
          console.error(
            `[FFmpegProcess ${this.processId}] FFmpeg spawn error:`,
            maskedError
          );
          this.isRunning = false;
          this.emit("error", err);
          reject(err);
        });

        // Handle process close
        this.ffmpegProcess.on("close", (code) => {
          console.log(
            `[FFmpegProcess ${this.processId}] FFmpeg process closed with code ${code}`
          );

          if (stderrData) {
            const maskedStderr = this.maskSensitiveData(stderrData);
            console.error("FFmpeg stderr:", maskedStderr);
          }

          const wasRunning = this.isRunning;
          this.isRunning = false;
          this.emit("stopped");

          // Auto-restart if process crashed unexpectedly
          if (wasRunning && code !== 0) {
            this.reconnectAttempts++;
            const delay = this.getReconnectDelay();

            if (delay !== null) {
              console.log(
                `[FFmpegProcess ${this.processId}] Attempting auto-restart ${this.reconnectAttempts} in ${delay}ms...`
              );

              setTimeout(() => {
                if (!this.isRunning) {
                  this.start().catch((e) =>
                    console.error(
                      `[FFmpegProcess ${this.processId}] Auto-restart failed:`,
                      e.message
                    )
                  );
                }
              }, delay);
            } else {
              console.error(
                `[FFmpegProcess ${this.processId}] Max reconnect attempts reached or reconnection disabled`
              );
            }
          }
        });

        // Handle stdout errors
        this.ffmpegProcess.stdout?.on("error", (err) => {
          console.error(
            `[FFmpegProcess ${this.processId}] Stdout error:`,
            err
          );
          this.emit("error", err);
        });

        // Handle stdin errors (for processes that write to stdin)
        this.ffmpegProcess.stdin?.on("error", (err) => {
          // Ignore EPIPE errors (happens when FFmpeg closes stdin)
          if ((err as NodeJS.ErrnoException).code !== "EPIPE") {
            console.error(
              `[FFmpegProcess ${this.processId}] Stdin error:`,
              err
            );
          }
        });
      } catch (error) {
        console.error(
          `[FFmpegProcess ${this.processId}] Failed to start:`,
          error
        );
        this.isRunning = false;
        reject(error);
      }
    });
  }

  /**
   * Stop the FFmpeg process
   */
  async stop(): Promise<void> {
    if (!this.isRunning && !this.ffmpegProcess) {
      console.warn(
        `[FFmpegProcess ${this.processId}] Not running, ignoring stop request`
      );
      return;
    }

    console.log(`[FFmpegProcess ${this.processId}] Stopping process...`);

    return new Promise((resolve) => {
      if (this.ffmpegProcess) {
        this.ffmpegProcess.kill("SIGKILL");
        this.ffmpegProcess = null;
      }

      this.isRunning = false;
      this.emit("stopped");

      console.log(`[FFmpegProcess ${this.processId}] Stopped successfully`);
      resolve();
    });
  }

  /**
   * Check if process is running
   */
  public running(): boolean {
    return this.isRunning;
  }

  /**
   * Get process ID
   */
  public getProcessId(): string {
    return this.processId;
  }
}
