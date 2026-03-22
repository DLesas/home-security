import { boolean, integer, text, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { camerasTable } from "./cameras";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  DETECTION_CLASSES,
  DEFAULT_CLASS_CONFIGS,
  DEFAULT_MODEL_SETTINGS,
  type ClassConfig,
  type DetectionClass,
  type DetectionModel,
  type KNNSettings,
  type MOG2Settings,
  type MotionModelSettings,
  type SimpleDiffSettings,
} from "../shared/camera";

export {
  DETECTION_CLASSES,
  DEFAULT_CLASS_CONFIGS,
  DEFAULT_MODEL_SETTINGS,
};
export type {
  ClassConfig,
  DetectionClass,
  DetectionModel,
  KNNSettings,
  MOG2Settings,
  MotionModelSettings,
  SimpleDiffSettings,
};

// Object detection model types
export const OBJECT_DETECTION_MODELS = [
  "yolov8n", "yolov8s", "yolov8m", "yolov8l", "yolov8x",
  "yolo11n", "yolo11s", "yolo11m", "yolo11l", "yolo11x",
  "yolo12n", "yolo12s", "yolo12m", "yolo12l", "yolo12x",
] as const;

export type ObjectDetectionModel = typeof OBJECT_DETECTION_MODELS[number];

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
