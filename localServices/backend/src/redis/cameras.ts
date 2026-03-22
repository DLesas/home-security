import { Repository, Schema } from "redis-om";
import { redis } from "./index";
import {
  DEFAULT_CLASS_CONFIGS,
  DEFAULT_MODEL_SETTINGS,
  DETECTION_CLASSES,
  type CameraDto,
  type ClassConfig,
  type DetectionClass,
  type DetectionModel,
  type KNNSettings,
  type MOG2Settings,
  type MotionModelSettings,
  type MotionZone,
  type SimpleDiffSettings,
} from "../db/shared/camera";

// Re-export for convenience
export type { DetectionModel, MotionModelSettings as ModelSettings, SimpleDiffSettings, KNNSettings, MOG2Settings };
export type { DetectionClass, ClassConfig };
export type { MotionZone };
export { DEFAULT_MODEL_SETTINGS, DEFAULT_CLASS_CONFIGS, DETECTION_CLASSES };

export enum CameraProtocol {
  UDP = "udp",
  RTSP = "rtsp",
}

const cameraSchema = new Schema("cameras", {
  name: { type: "string" },
  externalID: { type: "string" },
  building: { type: "string" },
  ipAddress: { type: "string" },
  port: { type: "number" },
  protocol: { type: "string" }, // "udp" or "rtsp"
  username: { type: "string" }, // RTSP authentication username (optional)
  password: { type: "string" }, // RTSP authentication password (optional)
  streamPath: { type: "string" }, // RTSP stream path, e.g., "/live/ch0" (optional)
  expectedSecondsUpdated: { type: "number" },
  lastUpdated: { type: "date" },
  // Target resolution (optional - if not set, uses native resolution from stream)
  targetWidth: { type: "number" },
  targetHeight: { type: "number" },
  // Motion detection settings
  motionDetectionEnabled: { type: "boolean" },
  // Detection model: "simple_diff" | "knn" | "mog2"
  detectionModel: { type: "string" },
  // Model-specific settings as JSON string
  modelSettings: { type: "string" },
  // Motion zones (JSON array) - empty points = full frame
  motionZones: { type: "string" },        // JSON: [{id, name, points, minContourArea, thresholdPercent}]
  // FPS caps (optional - acts as maximum, never upscales)
  maxStreamFps: { type: "number" },       // Max FPS for live streaming (default: 30)
  maxRecordingFps: { type: "number" },    // Max FPS for HLS recording (default: 15)
  // JPEG encoding quality (1-100, where 100=best, default: 95)
  jpegQuality: { type: "number" },
  // Object detection settings (per-camera: enabled flag and class configs only)
  // Model and clip durations are global settings in config.ts
  objectDetectionEnabled: { type: "boolean" },
  classConfigs: { type: "string" },          // JSON: ClassConfig[]
});


export const cameraRepository = new Repository(cameraSchema, redis);

export interface Camera extends Omit<CameraDto, "lastUpdated" | "protocol"> {
  protocol?: CameraProtocol;
  lastUpdated: Date;
}

export const createCameraIndex = async () => {
  try {
    await cameraRepository.createIndex();
    console.log("Camera index created successfully.");
  } catch (error) {
    console.error("Error creating camera index:", error);
  }
};


