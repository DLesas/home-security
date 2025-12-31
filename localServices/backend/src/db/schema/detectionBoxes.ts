import { integer, real, text, varchar } from "drizzle-orm/pg-core";
import { pgTable, index } from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { detectionsTable } from "./detections";
import { DetectionClass } from "./cameraSettings";

// Detection boxes table - stores individual bounding boxes for each detection
export const detectionBoxesTable = pgTable("detection_boxes", {
  id: text("id").primaryKey(),
  detectionId: text("detectionId")
    .references(() => detectionsTable.id, { onDelete: "cascade" })
    .notNull(),

  // COCO class identification
  classId: integer("classId").notNull(),
  className: varchar("className", { length: 50 })
    .$type<DetectionClass>()
    .notNull(),

  // Detection confidence score (0.0 - 1.0)
  confidence: real("confidence").notNull(),

  // Bounding box coordinates (normalized 0-1)
  x1: real("x1").notNull(),
  y1: real("y1").notNull(),
  x2: real("x2").notNull(),
  y2: real("y2").notNull(),
}, (table) => ({
  detectionIdIdx: index("detection_boxes_detection_id_idx").on(table.detectionId),
  classNameIdx: index("detection_boxes_class_name_idx").on(table.className),
}));

export type selectDetectionBox = InferSelectModel<typeof detectionBoxesTable>;
export type insertDetectionBox = InferInsertModel<typeof detectionBoxesTable>;
