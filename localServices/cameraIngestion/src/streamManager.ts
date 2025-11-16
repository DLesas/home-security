import { FrameGrabber } from "./frameGrabber";
import { createStreamCapture, StreamConfig } from "./streams/streamInterface";
import { cameraRepository, type Camera, CameraProtocol } from "./shared/redis/cameras";
import { redis } from "./shared/redis/index";
import { RedisClientType } from "redis";
import {
  DEFAULT_STREAM_FPS,
  DEFAULT_STREAM_WIDTH,
  DEFAULT_STREAM_HEIGHT,
} from "./config";

/**
 * StreamManager orchestrates multiple camera streams
 *
 * Responsibilities:
 * 1. Fetch all active cameras from Redis on startup
 * 2. Create and manage FrameGrabber instances for each camera
 * 3. Subscribe to Redis pub/sub for camera configuration changes
 * 4. Handle camera lifecycle (add/remove/update)
 * 5. Monitor stream health and attempt restarts on failure
 */
export class StreamManager {
  private grabbers: Map<string, FrameGrabber> = new Map();
  private pubSubClient: RedisClientType | null = null;
  private isRunning: boolean = false;

  constructor() {}

  /**
   * Initialize StreamManager and start managing camera streams
   */
  async initialize(): Promise<void> {
    if (this.isRunning) {
      console.warn("[StreamManager] Already running");
      return;
    }

    console.log("[StreamManager] Initializing...");

    // Fetch all active cameras from Redis
    const cameras = (await cameraRepository.search().returnAll()) as Camera[];

    console.log(`[StreamManager] Found ${cameras.length} cameras in Redis`);

    // Start frame grabbers for each camera
    for (const camera of cameras) {
      await this.addCamera(camera);
    }

    // Subscribe to camera configuration changes
    await this.subscribeToConfigChanges();

    this.isRunning = true;
    console.log("[StreamManager] Initialization complete");
  }

  /**
   * Add a camera and start its frame grabber
   */
  async addCamera(camera: Camera): Promise<void> {
    if (this.grabbers.has(camera.externalID)) {
      console.warn(`[StreamManager] Camera ${camera.externalID} already exists`);
      return;
    }

    try {
      console.log(`[StreamManager] Adding camera: ${camera.name} (${camera.externalID})`);

      // Build stream URL based on camera configuration
      const streamUrl = this.buildStreamUrl(camera);

      if (!streamUrl) {
        console.warn(
          `[StreamManager] Cannot build stream URL for camera ${camera.externalID}: missing IP or port`
        );
        return;
      }

      // Create stream config (defaults to 720p @ 30 FPS for performance)
      const streamConfig: StreamConfig = {
        cameraId: camera.externalID,
        streamUrl,
        fps: DEFAULT_STREAM_FPS,
        width: DEFAULT_STREAM_WIDTH,
        height: DEFAULT_STREAM_HEIGHT,
      };

      // Create stream capture (UDP or RTSP based on URL)
      const streamCapture = createStreamCapture(streamConfig);

      // Create frame grabber
      const frameGrabber = new FrameGrabber(streamCapture);

      // Start the frame grabber
      await frameGrabber.start();

      // Store in map
      this.grabbers.set(camera.externalID, frameGrabber);

      console.log(
        `[StreamManager] Camera ${camera.name} started successfully`
      );
    } catch (error) {
      console.error(
        `[StreamManager] Failed to add camera ${camera.externalID}:`,
        error
      );
    }
  }

  /**
   * Remove a camera and stop its frame grabber
   */
  async removeCamera(cameraId: string): Promise<void> {
    const frameGrabber = this.grabbers.get(cameraId);

    if (!frameGrabber) {
      console.warn(`[StreamManager] Camera ${cameraId} not found`);
      return;
    }

    try {
      console.log(`[StreamManager] Removing camera: ${cameraId}`);

      // Stop the frame grabber
      await frameGrabber.stop();

      // Remove from map
      this.grabbers.delete(cameraId);

      console.log(`[StreamManager] Camera ${cameraId} removed successfully`);
    } catch (error) {
      console.error(
        `[StreamManager] Failed to remove camera ${cameraId}:`,
        error
      );
    }
  }

  /**
   * Update camera configuration (restart with new config)
   */
  async updateCamera(camera: Camera): Promise<void> {
    console.log(`[StreamManager] Updating camera: ${camera.externalID}`);

    // Remove existing camera
    await this.removeCamera(camera.externalID);

    // Add camera with new configuration
    await this.addCamera(camera);
  }

  /**
   * Subscribe to Redis pub/sub for camera configuration changes
   */
  private async subscribeToConfigChanges(): Promise<void> {
    try {
      // Create a dedicated Redis client for pub/sub
      this.pubSubClient = redis.duplicate();
      await this.pubSubClient.connect();

      console.log("[StreamManager] Subscribing to CAMERA_CONFIG_CHANGED channel");

      // Subscribe to camera config changes
      await this.pubSubClient.subscribe("CAMERA_CONFIG_CHANGED", async (message) => {
        try {
          const event = JSON.parse(message);
          console.log("[StreamManager] Received camera config change:", event);

          switch (event.action) {
            case "add":
            case "update":
              // Fetch camera from Redis
              const camera = await cameraRepository.fetch(event.cameraId);
              if (camera) {
                await this.updateCamera(camera as Camera);
              }
              break;

            case "remove":
            case "delete":
              await this.removeCamera(event.cameraId);
              break;

            default:
              console.warn(`[StreamManager] Unknown action: ${event.action}`);
          }
        } catch (error) {
          console.error("[StreamManager] Error handling config change:", error);
        }
      });

      console.log("[StreamManager] Successfully subscribed to camera config changes");
    } catch (error) {
      console.error("[StreamManager] Failed to subscribe to config changes:", error);
    }
  }

  /**
   * Build stream URL from camera configuration
   * Supports both UDP and RTSP protocols based on camera.protocol field
   */
  private buildStreamUrl(camera: Camera): string | null {
    if (!camera.ipAddress || !camera.port) {
      return null;
    }

    // Use camera protocol field, default to UDP if not specified
    const protocol = camera.protocol || CameraProtocol.UDP;

    switch (protocol) {
      case CameraProtocol.RTSP:
        // RTSP format: rtsp://ip:port/stream
        // TODO: Make stream path configurable per camera (e.g., /stream1, /live, etc.)
        return `rtsp://${camera.ipAddress}:${camera.port}/stream`;

      case CameraProtocol.UDP:
      default:
        // UDP format: udp://ip:port
        return `udp://${camera.ipAddress}:${camera.port}`;
    }
  }

  /**
   * Stop all frame grabbers and cleanup
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn("[StreamManager] Not running");
      return;
    }

    console.log("[StreamManager] Stopping all camera streams...");

    // Stop all frame grabbers
    const stopPromises = Array.from(this.grabbers.values()).map((grabber) =>
      grabber.stop()
    );

    await Promise.all(stopPromises);

    // Unsubscribe from config changes
    if (this.pubSubClient) {
      await this.pubSubClient.unsubscribe("CAMERA_CONFIG_CHANGED");
      await this.pubSubClient.quit();
      this.pubSubClient = null;
    }

    this.grabbers.clear();
    this.isRunning = false;

    console.log("[StreamManager] All camera streams stopped");
  }

  /**
   * Get statistics about running cameras
   */
  getStats(): {
    totalCameras: number;
    runningCameras: number;
    cameras: Array<{ id: string; frameCount: number; running: boolean }>;
  } {
    const cameras = Array.from(this.grabbers.entries()).map(([id, grabber]) => ({
      id,
      frameCount: grabber.getFrameCount(),
      running: grabber.running(),
    }));

    return {
      totalCameras: this.grabbers.size,
      runningCameras: cameras.filter((c) => c.running).length,
      cameras,
    };
  }

  /**
   * Check if manager is running
   */
  public running(): boolean {
    return this.isRunning;
  }
}
