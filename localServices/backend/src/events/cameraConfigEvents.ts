import { redis } from "../redis/index";
import type {
  CameraConfigEvent,
  CameraDto,
  DeletedCameraConfigDto,
} from "../db/shared/camera";

/**
 * Camera configuration events for real-time updates to the camera ingestion service
 *
 * The camera ingestion service subscribes to this channel and immediately
 * reacts to camera configuration changes instead of polling Redis.
 */

const CAMERA_CONFIG_CHANNEL = process.env.CAMERA_CONFIG_CHANNEL || "camera:config";

/**
 * Publish a camera configuration change event
 * The camera ingestion service subscribes to this channel to react immediately
 *
 * @param action - The type of change (created, updated, deleted)
 * @param camera - The camera data (full camera for create/update, just externalID for delete)
 */
export async function publishCameraConfigChange(
  action: CameraConfigEvent["action"],
  camera: CameraDto | DeletedCameraConfigDto
): Promise<void> {
  try {
    const event: CameraConfigEvent = {
      timestamp: Date.now(),
      action,
      camera,
    };

    await redis.publish(CAMERA_CONFIG_CHANNEL, JSON.stringify(event));
    console.log(
      `[CameraConfig] Published ${action} event for camera: ${camera.externalID}`
    );
  } catch (error) {
    console.error("[CameraConfig] Failed to publish config change:", error);
    // Don't throw - config changes should still work even if pub/sub fails
  }
}

/**
 * Get the camera config channel name
 * Used by services that need to subscribe to camera config changes
 */
export function getCameraConfigChannel(): string {
  return CAMERA_CONFIG_CHANNEL;
}
