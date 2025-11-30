import { integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { buildingTable } from "./buildings";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const camerasTable = pgTable("cameras", {
  // Primary identifier (matches Redis externalID)
  id: text("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  buildingId: text("buildingId")
    .references(() => buildingTable.id, { onDelete: "cascade" }),

  // Network configuration
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv6 max length
  port: integer("port").notNull(),
  protocol: varchar("protocol", { length: 10 }).default("udp"), // "udp" or "rtsp"

  // RTSP authentication (optional)
  username: varchar("username", { length: 256 }),
  password: varchar("password", { length: 256 }),
  streamPath: varchar("streamPath", { length: 512 }),

  // Timestamps
  createdAt: timestamp("createdAt").defaultNow(),
  lastUpdated: timestamp("lastUpdated").defaultNow(),
});

export type selectCamera = InferSelectModel<typeof camerasTable>;
export type insertCamera = InferInsertModel<typeof camerasTable>;
