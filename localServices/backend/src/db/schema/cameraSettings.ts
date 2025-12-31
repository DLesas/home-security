import { boolean, integer, text, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { camerasTable } from "./cameras";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Motion detection model types
export type DetectionModel = "simple_diff" | "knn" | "mog2";

// Object detection model types
export const OBJECT_DETECTION_MODELS = [
  "yolov8n", "yolov8s", "yolov8m", "yolov8l", "yolov8x",
  "yolo11n", "yolo11s", "yolo11m", "yolo11l", "yolo11x",
  "yolo12n", "yolo12s", "yolo12m", "yolo12l", "yolo12x",
] as const;

export type ObjectDetectionModel = typeof OBJECT_DETECTION_MODELS[number];

// Supported detection classes (curated COCO subset)
export const DETECTION_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus",
  "train", "truck", "boat", "bird", "cat", "dog", "horse",
  "sheep", "cow", "elephant", "bear", "zebra", "giraffe",
] as const;

export type DetectionClass = typeof DETECTION_CLASSES[number];

// Per-class configuration with confidence threshold
export interface ClassConfig {
  class: DetectionClass;
  confidence: number; // 0.0 - 1.0
}

// Default class configs for object detection
export const DEFAULT_CLASS_CONFIGS: ClassConfig[] = [
  { class: "person", confidence: 0.5 },
  { class: "car", confidence: 0.5 },
  { class: "dog", confidence: 0.5 },
  { class: "cat", confidence: 0.5 },
];

// Model-specific settings types
export interface SimpleDiffSettings {
  threshold: number; // 0-255, default 25
}

export interface KNNSettings {
  history: number; // default 500
  dist2Threshold: number; // default 400
  detectShadows: boolean; // default false
}

export interface MOG2Settings {
  history: number; // default 500
  varThreshold: number; // default 16
  detectShadows: boolean; // default false
}

export type MotionModelSettings = SimpleDiffSettings | KNNSettings | MOG2Settings;

// Default settings for each model
export const DEFAULT_MODEL_SETTINGS: Record<DetectionModel, MotionModelSettings> = {
  simple_diff: { threshold: 25 },
  knn: { history: 500, dist2Threshold: 400, detectShadows: false },
  mog2: { history: 500, varThreshold: 16, detectShadows: false },
};

// Camera settings table (many-to-one with cameras, one is current)
export const cameraSettingsTable = pgTable("camera_settings", {
  id: text("id").primaryKey(),
  cameraId: text("cameraId")
    .references(() => camerasTable.id, { onDelete: "cascade" })
    .notNull(),

  // Target resolution (optional - if not set, uses native resolution)
  targetWidth: integer("targetWidth"),
  targetHeight: integer("targetHeight"),

  // Motion detection enabled flag
  motionDetectionEnabled: boolean("motionDetectionEnabled").default(true),

  // Detection model selection: "simple_diff" | "knn" | "mog2"
  detectionModel: varchar("detectionModel", { length: 20 })
    .$type<DetectionModel>()
    .notNull()
    .default("mog2"),

  // Model-specific settings as typed JSON
  modelSettings: jsonb("modelSettings")
    .$type<MotionModelSettings>()
    .notNull()
    .default({ history: 500, varThreshold: 16, detectShadows: false }),

  // FPS caps (acts as maximum, never upscales)
  maxStreamFps: integer("maxStreamFps").default(30),              // Max FPS for live streaming
  maxRecordingFps: integer("maxRecordingFps").default(15),        // Max FPS for HLS recording

  // JPEG encoding quality (1-100, where 100=best quality, default: 95)
  // Converted to FFmpeg -q:v scale (1-31) at encoding time
  jpegQuality: integer("jpegQuality").default(95),

  // Object detection settings (per-camera: enabled flag and class configs only)
  // Model and clip durations are global settings stored in Redis config
  objectDetectionEnabled: boolean("objectDetectionEnabled").default(false),
  classConfigs: jsonb("classConfigs")
    .$type<ClassConfig[]>()
    .default([
      { class: "person", confidence: 0.5 },
      { class: "car", confidence: 0.5 },
      { class: "dog", confidence: 0.5 },
      { class: "cat", confidence: 0.5 },
    ]),

  // Whether this is the active settings for the camera
  isCurrent: boolean("isCurrent").default(false),

  // Timestamps
  createdAt: timestamp("createdAt").defaultNow(),
});

export type selectCameraSettings = InferSelectModel<typeof cameraSettingsTable>;
export type insertCameraSettings = InferInsertModel<typeof cameraSettingsTable>;
