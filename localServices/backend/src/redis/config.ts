import { Repository, Schema } from "redis-om";
import { redis } from "./index";
import {
  type ObjectDetectionModel,
  OBJECT_DETECTION_MODELS,
} from "../db/schema/cameraSettings";

// Re-export for convenience
export type { ObjectDetectionModel };
export { OBJECT_DETECTION_MODELS };

const configSchema = new Schema("config", {
  sensorWarningTemparature: { type: "number" },
  sensorCriticalTemparature: { type: "number" },
  // Object detection global settings
  objectDetectionModel: { type: "string" },
  clipPreDuration: { type: "number" },
  clipPostDuration: { type: "number" },
});

export interface Config {
  sensorWarningTemparature: number;
  sensorCriticalTemparature: number;
  // Object detection global settings
  objectDetectionModel: ObjectDetectionModel;
  clipPreDuration: number;      // Seconds before detection for clip
  clipPostDuration: number;     // Seconds after detection for clip
}

export const configRepository = new Repository(configSchema, redis);
export const CONFIG_ENTITY_ID = process.env.CONFIG_ENTITY_ID || "default";

export const createConfigIndex = async () => {
  try {
    await configRepository.createIndex();
  } catch (error) {
    console.error("Error creating config index:", error);
  }
};

export const setDefaultConfig = async () => {
  // Check if config already exists in Redis (persisted via checkpoint)
  const existingConfig = await configRepository.fetch(CONFIG_ENTITY_ID);

  // If config exists and has required fields, don't overwrite
  if (existingConfig && existingConfig.sensorWarningTemparature !== undefined) {
    console.log("Config already exists in Redis, skipping default initialization");

    // But ensure object detection fields exist (for backwards compatibility)
    if (existingConfig.objectDetectionModel === undefined) {
      const defaultModel = (process.env.DEFAULT_OBJECT_DETECTION_MODEL || "yolov8n") as ObjectDetectionModel;
      const defaultClipPre = parseInt(process.env.DEFAULT_CLIP_PRE_DURATION || "10");
      const defaultClipPost = parseInt(process.env.DEFAULT_CLIP_POST_DURATION || "50");

      await configRepository.save(CONFIG_ENTITY_ID, {
        ...existingConfig,
        objectDetectionModel: defaultModel,
        clipPreDuration: defaultClipPre,
        clipPostDuration: defaultClipPost,
      } as Config);
      console.log("Added object detection defaults to existing config");
    }
    return;
  }

  // No existing config - set defaults
  const defaultWarning = 65;
  const defaultCritical = 75;

  const warningStr = process.env.SENSOR_WARNING_TEMPERATURE;
  const criticalStr = process.env.SENSOR_CRITICAL_TEMPERATURE;

  if (!warningStr || !criticalStr) {
    console.error(
      "SENSOR_WARNING_TEMPERATURE or SENSOR_CRITICAL_TEMPERATURE is not set"
    );
  }

  // Object detection defaults from env or hardcoded
  const defaultModel = (process.env.DEFAULT_OBJECT_DETECTION_MODEL || "yolov8n") as ObjectDetectionModel;
  const defaultClipPre = parseInt(process.env.DEFAULT_CLIP_PRE_DURATION || "10");
  const defaultClipPost = parseInt(process.env.DEFAULT_CLIP_POST_DURATION || "50");

  const payload: Config = {
    sensorWarningTemparature: parseInt(
      (warningStr ?? String(defaultWarning)).toString()
    ),
    sensorCriticalTemparature: parseInt(
      (criticalStr ?? String(defaultCritical)).toString()
    ),
    // Object detection global settings
    objectDetectionModel: defaultModel,
    clipPreDuration: defaultClipPre,
    clipPostDuration: defaultClipPost,
  };

  // Save to a constant ID to avoid duplicate config entities
  await configRepository.save(CONFIG_ENTITY_ID, payload);
  console.log("Initialized default config in Redis");
};

/**
 * Publish config change event for services watching global config.
 * Channel: "config:change"
 */
export const publishConfigChange = async () => {
  const config = await configRepository.fetch(CONFIG_ENTITY_ID);
  await redis.publish("config:change", JSON.stringify({
    action: "updated",
    config,
  }));
};
