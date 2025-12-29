import { boolean, integer, text, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { camerasTable } from "./cameras";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Detection model types
export type DetectionModel = "simple_diff" | "knn" | "mog2";

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

export type ModelSettings = SimpleDiffSettings | KNNSettings | MOG2Settings;

// Default settings for each model
export const DEFAULT_MODEL_SETTINGS: Record<DetectionModel, ModelSettings> = {
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
    .$type<ModelSettings>()
    .notNull()
    .default({ history: 500, varThreshold: 16, detectShadows: false }),

  // FPS caps (acts as maximum, never upscales)
  maxStreamFps: integer("maxStreamFps").default(30),              // Max FPS for live streaming
  maxRecordingFps: integer("maxRecordingFps").default(15),        // Max FPS for HLS recording

  // JPEG encoding quality (1-100, where 100=best quality, default: 95)
  // Converted to FFmpeg -q:v scale (1-31) at encoding time
  jpegQuality: integer("jpegQuality").default(95),

  // Whether this is the active settings for the camera
  isCurrent: boolean("isCurrent").default(false),

  // Timestamps
  createdAt: timestamp("createdAt").defaultNow(),
});

export type selectCameraSettings = InferSelectModel<typeof cameraSettingsTable>;
export type insertCameraSettings = InferInsertModel<typeof cameraSettingsTable>;
