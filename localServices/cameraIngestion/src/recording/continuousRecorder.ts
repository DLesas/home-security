import * as fs from "fs";
import * as path from "path";
import { FFmpegProcess } from "../streams/ffmpegProcess";
import {
  RECORDING_PATH,
  RETENTION_DAYS,
  SEGMENT_DURATION_SECONDS,
} from "../config";
import { getEncoderArgs } from "../utils/hardwareEncoder";

/**
 * ContinuousRecorder manages video recording for a single camera
 *
 * Features:
 * - Records JPEG frames to HLS video segments using FFmpeg
 * - Hardware-accelerated H.264 encoding (auto-detects: VideoToolbox, NVENC, QSV, etc.)
 * - Automatic segment rotation every N seconds (default: 10 minutes)
 * - Automatic cleanup of old recordings (default: 7 days retention)
 * - HLS format enables seamless scrubbing across segments in web players
 *
 * Directory structure:
 * /recordings/
 *   ├── camera1/
 *   │   ├── playlist.m3u8
 *   │   ├── segment-00001.ts
 *   │   ├── segment-00002.ts
 *   │   └── ...
 *   └── camera2/
 *       └── ...
 */
export class ContinuousRecorder {
  private cameraId: string;
  private cameraDir: string;
  private fps: number;
  private ffmpegProcess: FFmpegProcess;

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

      protected async buildFFmpegArgs(): Promise<string[]> {
        // Get hardware encoder arguments (auto-detected at startup)
        const encoderArgs = await getEncoderArgs();

        // Calculate max segments to keep (based on retention days)
        // Example: 7 days * 24 hours * 6 segments/hour = 1008 segments
        const maxSegments = Math.ceil(
          (RETENTION_DAYS * 24 * 60 * 60) / SEGMENT_DURATION_SECONDS
        );

        return [
          // Input from stdin (JPEG frames at variable rate)
          "-f", "image2pipe",
          "-vcodec", "mjpeg",
          "-i", "pipe:0",

          // Use fps filter to maintain constant frame rate (duplicates/drops frames as needed)
          "-vf", `fps=${this.fps}`,

          // Hardware-accelerated H.264 encoding
          ...encoderArgs,

          // HLS output options
          "-f", "hls",                                    // HLS format
          "-hls_time", `${SEGMENT_DURATION_SECONDS}`,    // Segment duration (10 min)
          "-hls_list_size", `${maxSegments}`,            // Max segments to keep in playlist
          "-hls_flags", "delete_segments",               // Auto-delete segments when limit reached
          "-hls_segment_type", "mpegts",                 // Use MPEG-TS containers
          "-hls_segment_filename", path.join(this.cameraDir, "segment-%05d.ts"), // Segment naming
          "-strftime", "0",                              // Don't use strftime (use sequential numbers)

          // Output playlist file
          path.join(this.cameraDir, "playlist.m3u8"),
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

      // Note: FFmpeg handles cleanup automatically via -hls_list_size and -hls_flags delete_segments
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
   * Note: Cleanup is handled automatically by FFmpeg
   *
   * FFmpeg configuration:
   * - hls_list_size: Limits playlist to N most recent segments
   * - hls_flags delete_segments: Auto-deletes old segment files
   *
   * When a new segment is created and the limit is reached,
   * FFmpeg automatically removes the oldest segment file and
   * updates the playlist accordingly.
   */

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
