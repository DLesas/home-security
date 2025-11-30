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
 * - timeout: Socket timeout for detecting disconnections
 */
export class RTSPStreamCapture extends FFmpegStreamCapture {
  constructor(config: StreamConfig) {
    super(config);
  }

  protected getLogPrefix(): string {
    return "[RTSPStreamCapture]";
  }

  /**
   * Build RTSP-specific FFmpeg input arguments
   * Optimized for reliable TCP transport and low latency
   */
  protected buildProtocolSpecificInputArgs(): string[] {
    return [
      "-rtsp_transport", "tcp",         // Use TCP for reliability (vs UDP)
      "-timeout", "10000000",           // Socket timeout: 10 seconds (in microseconds)
      "-max_delay", "500000",           // Maximum demux delay: 0.5 seconds
      "-reorder_queue_size", "0",       // Disable packet reordering for lower latency
    ];
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
