import { EventEmitter } from "events";

/**
 * Frame data structure emitted by stream captures
 */
export interface FrameData {
  frame: Buffer;      // Raw frame buffer (RGB24 or similar)
  timestamp: number;  // Unix timestamp in milliseconds
  width?: number;     // Frame width (optional, for metadata)
  height?: number;    // Frame height (optional, for metadata)
}

/**
 * Stream capture configuration
 */
export interface StreamConfig {
  cameraId: string;
  cameraName: string;
  streamUrl: string;  // URL or connection string (e.g., "udp://192.168.1.100:9000" or "rtsp://...")
  fps?: number;       // Target frame rate (default: 30)
  width?: number;     // Target width (optional, for resizing)
  height?: number;    // Target height (optional, for resizing)
}

/**
 * Abstract interface for video stream capture implementations
 * Provides a consistent API regardless of stream protocol (UDP, RTSP, HTTP, etc.)
 *
 * Events:
 * - 'frame': Emitted when a new frame is captured
 * - 'error': Emitted when an error occurs
 * - 'started': Emitted when stream capture starts successfully
 * - 'stopped': Emitted when stream capture stops
 */
export abstract class StreamCapture extends EventEmitter {
  protected config: StreamConfig;
  protected isRunning: boolean = false;

  constructor(config: StreamConfig) {
    super();
    this.config = config;
  }

  /**
   * Start capturing frames from the stream
   */
  abstract start(): Promise<void>;

  /**
   * Stop capturing frames and cleanup resources
   */
  abstract stop(): Promise<void>;

  /**
   * Check if the stream is currently running
   */
  public running(): boolean {
    return this.isRunning;
  }

  /**
   * Get the camera ID
   */
  public getCameraId(): string {
    return this.config.cameraId;
  }

  /**
   * Get the camera name
   */
  public getCameraName(): string {
    return this.config.cameraName;
  }

  /**
   * Get the stream URL
   */
  public getStreamUrl(): string {
    return this.config.streamUrl;
  }
}

/**
 * Factory function to create appropriate StreamCapture implementation based on URL
 * @param config - Stream configuration
 * @returns StreamCapture implementation (UDP, RTSP, etc.)
 */
export async function createStreamCapture(config: StreamConfig): Promise<StreamCapture> {
  const url = config.streamUrl.toLowerCase();

  if (url.startsWith("udp://")) {
    // Dynamically import to avoid circular dependencies
    const { UDPStreamCapture } = await import("./udpStreamCapture.js");
    return new UDPStreamCapture(config);
  } else if (url.startsWith("rtsp://") || url.startsWith("rtsps://")) {
    const { RTSPStreamCapture } = await import("./rtspStreamCapture.js");
    return new RTSPStreamCapture(config);
  } else {
    throw new Error(
      `Unsupported stream protocol: ${url}. Supported protocols: udp://, rtsp://`
    );
  }
}
