import { boolean, integer, real, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { camerasTable } from "./cameras";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Motion zones table (many-to-one with cameras)
// Empty points array = full frame detection
export const motionZonesTable = pgTable("motion_zones", {
  id: text("id").primaryKey(),             // Semantic ID (e.g., "default", "front-door")
  cameraId: text("cameraId")
    .references(() => camerasTable.id, { onDelete: "cascade" })
    .notNull(),

  // Zone identification
  name: text("name").notNull(),            // Display name (e.g., "Full Frame", "Front Door")

  // Zone polygon (JSON array of [x, y] tuples) - empty = full frame
  points: jsonb("points").$type<[number, number][]>().default([]),

  // Detection thresholds for this zone
  minContourArea: integer("minContourArea").default(2500),    // Min contour area in pixels (filters noise)
  thresholdPercent: real("thresholdPercent").default(2.5),    // Min % of zone area to trigger

  // Timestamps
  createdAt: timestamp("createdAt").defaultNow(),
  lastUpdated: timestamp("lastUpdated").defaultNow(),
});

export type selectMotionZone = InferSelectModel<typeof motionZonesTable>;
export type insertMotionZone = InferInsertModel<typeof motionZonesTable>;
