import { CameraController, CameraConfig } from "./controllers/CameraController";
import { RestartTracker } from "./controllers/RestartTracker";
import { cameraRepository, type Camera, CameraProtocol } from "./shared/redis/cameras";
import { redis } from "./shared/redis/index";
import { RedisClientType } from "redis";

/**
 * Camera configuration event from the backend service
 */
interface CameraConfigEvent {
  timestamp: number;
  action: "created" | "updated" | "deleted";
  camera: Camera | { externalID: string };
}

const CAMERA_CONFIG_CHANNEL = process.env.CAMERA_CONFIG_CHANNEL || "camera:config";

/**
 * StreamManager orchestrates multiple camera streams
 *
 * Responsibilities:
 * 1. Subscribe to Redis pub/sub for real-time camera config changes
 * 2. Create and manage CameraController instances for each camera
 * 3. React immediately to camera configuration changes (add/remove/update)
 * 4. Delegate restart logic to RestartTracker (owns all retry timing)
 *
 * Event-Driven Architecture:
 * - On startup, loads all cameras from Redis (initial state)
 * - Subscribes to CAMERA_CONFIG_CHANNEL for real-time updates
 * - Reacts immediately to created/updated/deleted events
 */
export class StreamManager {
  private cameras: Map<string, CameraController> = new Map();
  private subscriber: RedisClientType | null = null;
  private isRunning: boolean = false;
  private currentCameraIds: Set<string> = new Set();

  // RestartTracker per camera - owns all retry logic and timing
  private restartTrackers: Map<string, RestartTracker> = new Map();

  // Store camera configs for restart callbacks
  private cameraConfigs: Map<string, Camera> = new Map();

  constructor() {
    // Event-driven: no polling needed, RestartTracker handles timing
  }

  /**
   * Initialize StreamManager and start managing camera streams
   */
  async initialize(): Promise<void> {
    if (this.isRunning) {
      console.warn("[StreamManager] Already running");
      return;
    }

    console.log("[StreamManager] Initializing...");

    // Perform initial camera discovery (load current state from Redis)
    await this.discoverCameras();

    // Subscribe to camera config events for real-time updates
    await this.subscribeToConfigEvents();

    this.isRunning = true;
    console.log(
      `[StreamManager] Initialization complete (subscribed to ${CAMERA_CONFIG_CHANNEL})`
    );
  }

  /**
   * Subscribe to camera configuration events via Redis pub/sub
   * Reacts immediately to camera create/update/delete events from backend
   */
  private async subscribeToConfigEvents(): Promise<void> {
    try {
      // Create a duplicate client for pub/sub (Redis requires separate connection)
      this.subscriber = redis.duplicate();
      await this.subscriber.connect();

      console.log(`[StreamManager] Subscribing to ${CAMERA_CONFIG_CHANNEL}...`);

      // Subscribe to camera config channel
      await this.subscriber.subscribe(CAMERA_CONFIG_CHANNEL, async (message) => {
        try {
          const event: CameraConfigEvent = JSON.parse(message);
          await this.handleConfigEvent(event);
        } catch (error) {
          console.error("[StreamManager] Error parsing config event:", error);
        }
      });

      console.log(`[StreamManager] Subscribed to ${CAMERA_CONFIG_CHANNEL}`);
    } catch (error) {
      console.error("[StreamManager] Failed to subscribe to config events:", error);
      throw error;
    }
  }

  /**
   * Handle a camera configuration event from the backend
   */
  private async handleConfigEvent(event: CameraConfigEvent): Promise<void> {
    console.log(
      `[StreamManager] Received config event: ${event.action} for camera ${
        "externalID" in event.camera ? event.camera.externalID : (event.camera as Camera).externalID
      }`
    );

    switch (event.action) {
      case "created":
        await this.addCamera(event.camera as Camera);
        this.currentCameraIds.add((event.camera as Camera).externalID);
        break;

      case "updated":
        await this.updateCamera(event.camera as Camera);
        break;

      case "deleted":
        const externalID = "externalID" in event.camera
          ? event.camera.externalID
          : (event.camera as Camera).externalID;
        await this.removeCamera(externalID);
        this.currentCameraIds.delete(externalID);
        break;

      default:
        console.warn(`[StreamManager] Unknown config event action: ${event.action}`);
    }
  }

  /**
   * Add a camera and start its controller
   */
  async addCamera(camera: Camera): Promise<void> {
    if (this.cameras.has(camera.externalID)) {
      console.warn(`[StreamManager] Camera ${camera.name} already exists`);
      return;
    }

    // Store camera config for restart callbacks
    this.cameraConfigs.set(camera.externalID, camera);

    // Create RestartTracker if it doesn't exist (survives controller restarts)
    if (!this.restartTrackers.has(camera.externalID)) {
      const tracker = new RestartTracker({
        cameraId: camera.externalID,
        cameraName: camera.name,
        onRestart: () => this.performRestart(camera.externalID),
      });
      this.restartTrackers.set(camera.externalID, tracker);
    }

    await this.startCamera(camera);
  }

  /**
   * Start a camera controller (used by addCamera and RestartTracker)
   */
  private async startCamera(camera: Camera): Promise<void> {
    try {
      console.log(`[StreamManager] Starting camera: ${camera.name}`);

      // Build stream URL based on camera configuration
      const streamUrl = this.buildStreamUrl(camera);

      if (!streamUrl) {
        console.warn(
          `[StreamManager] Cannot build stream URL for camera ${camera.name}: missing IP or port`
        );
        throw new Error("Missing IP or port");
      }

      // Create camera config
      const config: CameraConfig = {
        cameraId: camera.externalID,
        cameraName: camera.name,
        streamUrl,
        motionDetectionEnabled: camera.motionDetectionEnabled ?? true,
        targetWidth: camera.targetWidth,
        targetHeight: camera.targetHeight,
        maxStreamFps: camera.maxStreamFps,
        maxRecordingFps: camera.maxRecordingFps,
        jpegQuality: camera.jpegQuality,
      };

      // Create camera controller
      const controller = new CameraController(config);

      // Listen for restartNeeded event - delegate to RestartTracker
      controller.on("restartNeeded", () => {
        const tracker = this.restartTrackers.get(camera.externalID);
        if (tracker) {
          tracker.requestRestart();
        }
      });

      // Store in map BEFORE starting (prevents race conditions)
      this.cameras.set(camera.externalID, controller);

      // Start the controller (probes, starts stream capture, starts recorder)
      await controller.start();

      // Camera started successfully - tell RestartTracker it's healthy
      const tracker = this.restartTrackers.get(camera.externalID);
      if (tracker) {
        tracker.markHealthy();
      }

      console.log(`[StreamManager] Camera ${camera.name} started successfully`);
    } catch (error) {
      console.error(`[StreamManager] Failed to start camera ${camera.name}:`, error);
      // Remove from map if start failed
      this.cameras.delete(camera.externalID);
      throw error; // Re-throw so RestartTracker can schedule a retry
    }
  }

  /**
   * Perform a restart for a camera (called by RestartTracker)
   */
  private async performRestart(cameraId: string): Promise<void> {
    const camera = this.cameraConfigs.get(cameraId);
    if (!camera) {
      console.error(`[StreamManager] No config found for camera ${cameraId}`);
      throw new Error("Camera config not found");
    }

    console.log(`[StreamManager] Performing restart for camera: ${camera.name}`);

    // Dispose the old controller if it exists
    const oldController = this.cameras.get(cameraId);
    if (oldController) {
      await oldController.dispose();
      this.cameras.delete(cameraId);
    }

    // Wait a moment before restarting
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start a new controller
    await this.startCamera(camera);
  }

  /**
   * Remove a camera and dispose its controller (permanent removal)
   */
  async removeCamera(cameraId: string): Promise<void> {
    const controller = this.cameras.get(cameraId);

    // Dispose RestartTracker for this camera
    const tracker = this.restartTrackers.get(cameraId);
    if (tracker) {
      tracker.dispose();
      this.restartTrackers.delete(cameraId);
    }

    // Remove stored config
    this.cameraConfigs.delete(cameraId);

    if (!controller) {
      return;
    }

    const cameraName = controller.getCameraName();

    try {
      console.log(`[StreamManager] Removing camera: ${cameraName}`);

      // Dispose the controller FIRST (prevents any new events from being processed)
      await controller.dispose();

      // Remove from map AFTER disposal completes
      this.cameras.delete(cameraId);

      console.log(`[StreamManager] Camera ${cameraName} removed successfully`);
    } catch (error) {
      console.error(`[StreamManager] Failed to remove camera ${cameraName}:`, error);
      // Still remove from map even if disposal fails
      this.cameras.delete(cameraId);
    }
  }

  /**
   * Update camera configuration (only restart if ingestion-relevant fields changed)
   */
  async updateCamera(camera: Camera): Promise<void> {
    const existingConfig = this.cameraConfigs.get(camera.externalID);

    if (!existingConfig) {
      // Camera doesn't exist, add it
      console.log(`[StreamManager] Camera ${camera.externalID} not found, adding it`);
      await this.addCamera(camera);
      return;
    }

    // Check if any ingestion-relevant fields changed
    const requiresRestart = this.hasIngestionRelevantChanges(existingConfig, camera);

    if (requiresRestart) {
      console.log(`[StreamManager] Restarting camera ${camera.externalID} due to ingestion config change`);

      // Remove existing camera
      await this.removeCamera(camera.externalID);

      // Add camera with new configuration
      await this.addCamera(camera);
    } else {
      // Just update the stored config without restarting
      console.log(`[StreamManager] Updating camera ${camera.externalID} config (no restart needed)`);
      this.cameraConfigs.set(camera.externalID, camera);
    }
  }

  /**
   * Check if any fields that affect ingestion have changed
   *
   * Fields that require restart:
   * - Stream URL: ipAddress, port, protocol, username, password, streamPath
   * - FFmpeg pipeline: targetWidth, targetHeight, maxStreamFps, maxRecordingFps
   * - Motion detection: motionDetectionEnabled (controls frame publishing to Redis streams)
   *
   * Fields that do NOT require restart:
   * - Metadata: name, building, expectedSecondsUpdated
   * - Motion config (handled by motion service): mog2History, mog2VarThreshold, mog2DetectShadows, motionZones
   */
  private hasIngestionRelevantChanges(oldConfig: Camera, newConfig: Camera): boolean {
    // Stream URL components
    if (oldConfig.ipAddress !== newConfig.ipAddress) return true;
    if (oldConfig.port !== newConfig.port) return true;
    if (oldConfig.protocol !== newConfig.protocol) return true;
    if (oldConfig.username !== newConfig.username) return true;
    if (oldConfig.password !== newConfig.password) return true;
    if (oldConfig.streamPath !== newConfig.streamPath) return true;

    // Resolution
    if (oldConfig.targetWidth !== newConfig.targetWidth) return true;
    if (oldConfig.targetHeight !== newConfig.targetHeight) return true;

    // FPS caps
    if (oldConfig.maxStreamFps !== newConfig.maxStreamFps) return true;
    if (oldConfig.maxRecordingFps !== newConfig.maxRecordingFps) return true;

    // Motion detection toggle (controls whether frames are pushed to Redis streams)
    if (oldConfig.motionDetectionEnabled !== newConfig.motionDetectionEnabled) return true;

    // JPEG encoding quality
    if (oldConfig.jpegQuality !== newConfig.jpegQuality) return true;

    return false;
  }

  /**
   * Discover all cameras from Redis and start their streams
   */
  private async discoverCameras(): Promise<void> {
    try {
      const cameras = (await cameraRepository.search().returnAll()) as Camera[];

      console.log(`[StreamManager] Found ${cameras.length} cameras in Redis`);

      // Update current camera IDs
      this.currentCameraIds = new Set(cameras.map((c) => c.externalID));

      // Start each camera
      for (const camera of cameras) {
        await this.addCamera(camera);
      }
    } catch (error) {
      console.error("[StreamManager] Error discovering cameras:", error);
    }
  }

  /**
   * Build stream URL from camera configuration
   */
  private buildStreamUrl(camera: Camera): string | null {
    if (!camera.ipAddress || !camera.port) {
      return null;
    }

    const protocol = camera.protocol || CameraProtocol.UDP;

    switch (protocol) {
      case CameraProtocol.RTSP:
        let rtspUrl = 'rtsp://';

        if (camera.username && camera.password) {
          rtspUrl += `${camera.username}:${camera.password}@`;
        }

        rtspUrl += `${camera.ipAddress}:${camera.port}`;

        const streamPath = camera.streamPath || '/stream';
        rtspUrl += streamPath;

        return rtspUrl;

      case CameraProtocol.UDP:
      default:
        return `udp://${camera.ipAddress}:${camera.port}`;
    }
  }

  /**
   * Stop all camera controllers and cleanup
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn("[StreamManager] Not running");
      return;
    }

    console.log("[StreamManager] Stopping all camera streams...");

    // Dispose all RestartTrackers
    for (const tracker of this.restartTrackers.values()) {
      tracker.dispose();
    }
    this.restartTrackers.clear();

    // Unsubscribe from config events and disconnect subscriber
    if (this.subscriber) {
      try {
        await this.subscriber.unsubscribe(CAMERA_CONFIG_CHANNEL);
        await this.subscriber.quit();
        this.subscriber = null;
        console.log(`[StreamManager] Unsubscribed from ${CAMERA_CONFIG_CHANNEL}`);
      } catch (error) {
        console.error("[StreamManager] Error cleaning up subscriber:", error);
      }
    }

    // Dispose all camera controllers
    const disposePromises = Array.from(this.cameras.values()).map((controller) =>
      controller.dispose()
    );

    await Promise.all(disposePromises);

    this.cameras.clear();
    this.cameraConfigs.clear();
    this.currentCameraIds.clear();
    this.isRunning = false;

    console.log("[StreamManager] All camera streams stopped");
  }

  /**
   * Get statistics about running cameras
   */
  getStats(): {
    totalCameras: number;
    runningCameras: number;
    retryingCameras: number;
    cameras: Array<{ id: string; name: string; frameCount: number; running: boolean; state: string; retrying: boolean }>;
  } {
    const cameraStats = Array.from(this.cameras.entries()).map(([id, controller]) => {
      const tracker = this.restartTrackers.get(id);
      const trackerState = tracker?.getState();

      return {
        id,
        name: controller.getCameraName(),
        frameCount: controller.getFrameCount(),
        running: controller.running(),
        state: controller.state,
        retrying: trackerState?.isRetrying ?? false,
      };
    });

    // Add cameras that are only in restartTrackers (retrying but no controller)
    for (const [id, tracker] of this.restartTrackers.entries()) {
      if (!this.cameras.has(id)) {
        const camera = this.cameraConfigs.get(id);
        const trackerState = tracker.getState();

        cameraStats.push({
          id,
          name: camera?.name ?? "Unknown",
          frameCount: 0,
          running: false,
          state: "retrying",
          retrying: trackerState.isRetrying,
        });
      }
    }

    return {
      totalCameras: this.cameraConfigs.size,
      runningCameras: cameraStats.filter((c) => c.running).length,
      retryingCameras: cameraStats.filter((c) => c.retrying).length,
      cameras: cameraStats,
    };
  }

  /**
   * Check if manager is running
   */
  public running(): boolean {
    return this.isRunning;
  }
}
