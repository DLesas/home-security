import * as fs from "fs";
import * as path from "path";
import { FFmpegProcess } from "../streams/ffmpegProcess";
import {
  RECORDING_PATH,
  RETENTION_DAYS,
  SEGMENT_DURATION_SECONDS,
} from "../config";

/**
 * ContinuousRecorder manages video recording for a single camera
 *
 * Features:
 * - Records JPEG frames to video segments using FFmpeg
 * - Automatic segment rotation every N seconds (default: 10 minutes)
 * - Automatic cleanup of old recordings (default: 7 days retention)
 * - Uses FFmpeg's segment muxer to write directly to disk
 * - No re-encoding (JPEG frames are muxed into MKV container)
 *
 * Directory structure:
 * /recordings/
 *   ├── camera1/
 *   │   ├── 2023-11-11_14-30-00.mkv
 *   │   ├── 2023-11-11_14-40-00.mkv
 *   │   └── ...
 *   └── camera2/
 *       └── ...
 */
export class ContinuousRecorder {
  private cameraId: string;
  private cameraDir: string;
  private fps: number;
  private ffmpegProcess: FFmpegProcess;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(cameraId: string, fps: number = 30) {
    this.cameraId = cameraId;
    this.fps = fps;
    this.cameraDir = path.join(RECORDING_PATH, cameraId);

    // Create FFmpeg process for recording
    this.ffmpegProcess = new (class extends FFmpegProcess {
      constructor(
        cameraId: string,
        private cameraDir: string,
        private fps: number
      ) {
        super(cameraId);
      }

      protected buildFFmpegArgs(): string[] {
        return [
          // Input from stdin (JPEG frames at variable rate)
          "-f", "image2pipe",
          "-vcodec", "mjpeg",
          "-i", "pipe:0",

          // Use fps filter to maintain constant frame rate (duplicates/drops frames as needed)
          "-vf", `fps=${this.fps}`,

          // Output options - mux JPEGs into MKV segments without re-encoding
          "-c:v", "mjpeg",                   // Output as MJPEG (required when using filter)
          "-f", "segment",                   // Enable segmentation
          "-segment_time", `${SEGMENT_DURATION_SECONDS}`, // Rotate every N seconds (auto rotation)
          "-segment_format", "matroska",     // Use MKV container
          "-segment_atclocktime", "1",       // Align segments to clock time
          "-strftime", "1",                  // Enable strftime in output filename
          "-reset_timestamps", "1",          // Reset timestamps for each segment

          // Output filename pattern with timestamp - FFmpeg creates new files automatically
          path.join(this.cameraDir, "%Y-%m-%d_%H-%M-%S.mkv"),
        ];
      }

      protected handleStderr(chunk: Buffer): void {
        const message = chunk.toString();
        // Only log errors and warnings, not all FFmpeg output
        if (message.includes("error") || message.includes("warning")) {
          console.error(`[Recorder ${this.getProcessId()}] FFmpeg:`, message);
        }
      }
    })(cameraId, this.cameraDir, this.fps);

    // Forward events
    this.ffmpegProcess.on("started", () => {
      console.log(`[Recorder ${this.cameraId}] Recording started successfully`);
    });

    this.ffmpegProcess.on("stopped", () => {
      console.log(`[Recorder ${this.cameraId}] Recording stopped`);
    });

    this.ffmpegProcess.on("error", (err) => {
      console.error(`[Recorder ${this.cameraId}] Error:`, err.message);
    });
  }

  /**
   * Start recording frames to disk
   */
  async start(): Promise<void> {
    try {
      // Ensure camera directory exists
      await fs.promises.mkdir(this.cameraDir, { recursive: true });

      console.log(`[Recorder ${this.cameraId}] Starting recording to ${this.cameraDir}`);
      console.log(
        `[Recorder ${this.cameraId}] Configuration: ${SEGMENT_DURATION_SECONDS}s segments, ${RETENTION_DAYS} days retention`
      );

      // Start FFmpeg process
      await this.ffmpegProcess.start();

      // Start cleanup task (runs every hour)
      this.startCleanupTask();
    } catch (error) {
      console.error(`[Recorder ${this.cameraId}] Failed to start recording:`, error);
      throw error;
    }
  }

  /**
   * Write a JPEG frame to the recording
   */
  writeFrame(jpegBuffer: Buffer): void {
    if (!this.ffmpegProcess.running()) {
      return;
    }

    try {
      // Access the underlying FFmpeg process's stdin
      const stdin = (this.ffmpegProcess as any).ffmpegProcess?.stdin;
      if (stdin) {
        stdin.write(jpegBuffer);
      }
    } catch (error) {
      console.error(`[Recorder ${this.cameraId}] Failed to write frame:`, error);
    }
  }

  /**
   * Stop recording
   */
  async stop(): Promise<void> {
    console.log(`[Recorder ${this.cameraId}] Stopping recording...`);

    // Stop cleanup task
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close stdin to signal end of input, then stop
    const stdin = (this.ffmpegProcess as any).ffmpegProcess?.stdin;
    if (stdin) {
      stdin.end();
    }

    // Give FFmpeg time to finish writing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Stop the process
    await this.ffmpegProcess.stop();
  }

  /**
   * Start periodic cleanup of old recordings
   */
  private startCleanupTask(): void {
    // Run cleanup immediately
    this.cleanupOldRecordings().catch((err) =>
      console.error(`[Recorder ${this.cameraId}] Cleanup failed:`, err)
    );

    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldRecordings().catch((err) =>
        console.error(`[Recorder ${this.cameraId}] Cleanup failed:`, err)
      );
    }, 60 * 60 * 1000);
  }

  /**
   * Delete recordings older than RETENTION_DAYS
   */
  private async cleanupOldRecordings(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.cameraDir);
      const now = Date.now();
      const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

      let deletedCount = 0;

      for (const file of files) {
        // Only process video files
        if (!file.endsWith(".mkv")) {
          continue;
        }

        const filePath = path.join(this.cameraDir, file);
        const stats = await fs.promises.stat(filePath);

        // Delete if older than retention period
        if (now - stats.mtimeMs > retentionMs) {
          await fs.promises.unlink(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(
          `[Recorder ${this.cameraId}] Cleanup: deleted ${deletedCount} old recording(s)`
        );
      }
    } catch (error) {
      console.error(`[Recorder ${this.cameraId}] Cleanup error:`, error);
    }
  }

  /**
   * Check if recorder is currently recording
   */
  public recording(): boolean {
    return this.ffmpegProcess.running();
  }

  /**
   * Get camera ID
   */
  public getCameraId(): string {
    return this.cameraId;
  }
}
