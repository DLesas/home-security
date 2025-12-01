import { Repository, Schema } from "redis-om";
import { redis } from "./index";

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
  // MOG2 background subtractor settings (per-camera)
  mog2History: { type: "number" },        // Frames for background model
  mog2VarThreshold: { type: "number" },   // Variance threshold for foreground detection
  mog2DetectShadows: { type: "boolean" }, // Detect and mark shadows
  // Motion zones (JSON array) - empty points = full frame
  motionZones: { type: "string" },        // JSON: [{id, name, points, minContourArea, thresholdPercent}]
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
  // Motion detection settings (all required when motion detection is enabled)
  motionDetectionEnabled: boolean;
  // MOG2 background subtractor settings
  mog2History: number;        // Frames for background model
  mog2VarThreshold: number;   // Variance threshold for foreground detection
  mog2DetectShadows: boolean; // Detect and mark shadows
  // Motion zones - at least one required, stored as JSON string in Redis
  motionZones: MotionZone[];
}

export const createCameraIndex = async () => {
  try {
    await cameraRepository.createIndex();
    console.log("Camera index created successfully.");
  } catch (error) {
    console.error("Error creating camera index:", error);
  }
};


