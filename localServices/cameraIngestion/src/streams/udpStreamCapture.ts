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

  protected getLogPrefix(): string {
    return "[UDPStreamCapture]";
  }

  /**
   * Build UDP-specific FFmpeg input arguments
   * Optimized for low-latency streaming with minimal buffering
   */
  protected buildProtocolSpecificInputArgs(): string[] {
    return [
      "-fflags", "nobuffer",
      "-flags", "low_delay",
      "-strict", "experimental",
      "-analyzeduration", "0",
      "-probesize", "32",
    ];
  }
}
