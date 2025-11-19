import { FFmpegStreamCapture } from "./ffmpegStreamCapture";
import { StreamConfig } from "./streamInterface";

/**
 * RTSP Stream Capture Implementation
 * Captures video frames from RTSP streams using FFmpeg
 *
 * Example stream URLs:
 * - rtsp://192.168.1.100:554/stream1
 * - rtsp://username:password@192.168.1.100:554/stream1
 * - rtsps://192.168.1.100:322/secure_stream (RTSP over TLS)
 *
 * RTSP advantages over UDP:
 * - Built-in connection management
 * - Authentication support
 * - Better error recovery
 * - Automatic reconnection by FFmpeg
 *
 * FFmpeg options optimized for RTSP:
 * - rtsp_transport tcp: Use TCP instead of UDP for reliability
 * - stimeout: Socket timeout for detecting disconnections
 */
export class RTSPStreamCapture extends FFmpegStreamCapture {
  constructor(config: StreamConfig) {
    super(config);
  }

  protected buildFFmpegArgs(): string[] {
    const args = [
      // Input options for RTSP
      "-rtsp_transport", "tcp",         // Use TCP for reliability (vs UDP)
      "-stimeout", "5000000",           // Socket timeout: 5 seconds (in microseconds)
      "-fflags", "nobuffer",            // Don't buffer input
      "-flags", "low_delay",            // Optimize for low latency
      "-strict", "experimental",
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

  /**
   * Override reconnection strategy with fixed delay
   * Note: Max reconnect attempts are limited by the internal FFmpegProcess
   *
   * TODO: Re-implement proper exponential backoff once getReconnectDelay()
   * signature is updated to accept attempt count as parameter. This would allow:
   * - Exponential backoff: 1s, 2s, 4s, 8s, ... up to 30s max
   * - Max reconnect attempts limit (e.g., 10 attempts)
   */
  protected getReconnectDelay(): number | null {
    // Fixed delay with moderate backoff
    return 10000; // 10 second delay
  }

  /**
   * Override to mask credentials in RTSP URLs for security
   * Converts rtsp://user:pass@ip/stream to rtsp://***:***@ip/stream
   */
  protected maskSensitiveData(text: string): string {
    return text.replace(
      /rtsp:\/\/([^:]+):([^@]+)@/gi,
      "rtsp://***:***@"
    );
  }
}
