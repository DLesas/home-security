import { boolean, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { camerasTable } from "./cameras";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

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

  // MOG2 background subtractor settings (per-camera)
  mog2History: integer("mog2History").default(500),               // Frames for background model
  mog2VarThreshold: real("mog2VarThreshold").default(16),         // Variance threshold for foreground
  mog2DetectShadows: boolean("mog2DetectShadows").default(false), // Detect and mark shadows

  // Whether this is the active settings for the camera
  isCurrent: boolean("isCurrent").default(false),

  // Timestamps
  createdAt: timestamp("createdAt").defaultNow(),
});

export type selectCameraSettings = InferSelectModel<typeof cameraSettingsTable>;
export type insertCameraSettings = InferInsertModel<typeof cameraSettingsTable>;
