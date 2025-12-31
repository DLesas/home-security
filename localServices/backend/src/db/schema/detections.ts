import { real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { camerasTable } from "./cameras";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { ObjectDetectionModel } from "./cameraSettings";

// Clip processing status
export const CLIP_STATUSES = ["pending", "processing", "complete", "failed"] as const;
export type ClipStatus = typeof CLIP_STATUSES[number];

// Detections table - stores object detection events
export const detectionsTable = pgTable("detections", {
  id: text("id").primaryKey(),
  cameraId: text("cameraId")
    .references(() => camerasTable.id, { onDelete: "cascade" })
    .notNull(),

  // When the detection occurred
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),

  // Model used for detection
  modelUsed: varchar("modelUsed", { length: 50 })
    .$type<ObjectDetectionModel>()
    .notNull(),

  // Processing performance
  processingTimeMs: real("processingTimeMs"),

  // Video clip reference (filled async by cameraIngestion)
  clipPath: text("clipPath"),
  clipStatus: varchar("clipStatus", { length: 20 })
    .$type<ClipStatus>()
    .default("pending"),
});

export type selectDetection = InferSelectModel<typeof detectionsTable>;
export type insertDetection = InferInsertModel<typeof detectionsTable>;
