import { FFmpegStreamCapture } from "./ffmpegStreamCapture";
import { StreamConfig } from "./streamInterface";

/**
 * UDP Stream Capture Implementation
 * Captures video frames from UDP streams using FFmpeg
 *
 * Example stream URL: udp://192.168.1.100:9000
 *
 * FFmpeg options optimized for low-latency UDP streaming:
 * - fifo_size: Large buffer to handle UDP packet bursts
 * - overrun_nonfatal: Don't fail on buffer overrun
 * - flags=low_delay: Minimize latency
 * - fflags=nobuffer: Disable input buffering
 */
export class UDPStreamCapture extends FFmpegStreamCapture {
  constructor(config: StreamConfig) {
    super(config);
  }

  protected buildFFmpegArgs(): string[] {
    const args = [
      // Input options for low-latency UDP
      "-fflags", "nobuffer",
      "-flags", "low_delay",
      "-strict", "experimental",
      "-analyzeduration", "0",
      "-probesize", "32",
      // Input source
      "-i", this.config.streamUrl,
      // Output options
      "-f", "image2pipe",               // Output as image stream
      "-pix_fmt", "rgb24",              // RGB24 pixel format
      "-vcodec", "rawvideo",            // Raw video output
      "-r", `${this.config.fps || 30}`, // Frame rate
    ];

    // Apply resolution if specified
    if (this.config.width && this.config.height) {
      args.push("-s", `${this.config.width}x${this.config.height}`);
    }

    // Output to stdout
    args.push("pipe:1");

    return args;
  }
}
