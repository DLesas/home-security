import { Repository, Schema } from "redis-om";
import { redis } from "./index";
import {
  type DetectionModel,
  type MotionModelSettings,
  type SimpleDiffSettings,
  type KNNSettings,
  type MOG2Settings,
  type DetectionClass,
  type ClassConfig,
  DEFAULT_MODEL_SETTINGS,
  DEFAULT_CLASS_CONFIGS,
  DETECTION_CLASSES,
} from "../db/schema/cameraSettings";

// Re-export for convenience
export type { DetectionModel, MotionModelSettings as ModelSettings, SimpleDiffSettings, KNNSettings, MOG2Settings };
export type { DetectionClass, ClassConfig };
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

/**
 * Motion detection zone configuration.
 * Empty points array = full frame detection.
 * Only active (non-deleted) zones are stored in Redis.
 */
export interface MotionZone {
  id: string;                             // Semantic ID (e.g., "default", "front-door")
  name: string;                           // Display name
  points: [number, number][];             // Polygon vertices, empty = full frame
  minContourArea: number;                 // Min contour area in pixels
  thresholdPercent: number;               // Min % of zone area to trigger
}

export interface Camera {
  name: string;
  externalID: string;
  building: string; // Required
  ipAddress?: string;
  port: number;
  protocol?: CameraProtocol;
  username?: string;
  password?: string;
  streamPath?: string;
  expectedSecondsUpdated: number;
  lastUpdated: Date;
  // Target resolution (optional)
  targetWidth?: number;
  targetHeight?: number;
  // Motion detection settings
  motionDetectionEnabled: boolean;
  // Detection model: "simple_diff" | "knn" | "mog2"
  detectionModel: DetectionModel;
  // Model-specific settings (stored as JSON string in Redis)
  modelSettings: MotionModelSettings;
  // Motion zones - at least one required, stored as JSON string in Redis
  motionZones: MotionZone[];
  // FPS caps (optional - acts as maximum, never upscales)
  maxStreamFps?: number;      // Max FPS for live streaming (default: 30)
  maxRecordingFps?: number;   // Max FPS for HLS recording (default: 15)
  // JPEG encoding quality (1-100, where 100=best, default: 95)
  jpegQuality?: number;
  // Object detection settings (per-camera: enabled flag and class configs only)
  // Model and clip durations are global settings in config.ts
  objectDetectionEnabled: boolean;
  classConfigs: ClassConfig[];
}

export const createCameraIndex = async () => {
  try {
    await cameraRepository.createIndex();
    console.log("Camera index created successfully.");
  } catch (error) {
    console.error("Error creating camera index:", error);
  }
};


