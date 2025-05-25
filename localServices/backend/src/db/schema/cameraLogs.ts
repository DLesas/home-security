import {
  bigserial,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { camerasTable } from "./cameras";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const cameraLogsTable = pgTable("cameraLogs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  cameraId: text("cameraId")
    .notNull()
    .references(() => camerasTable.id, { onDelete: "cascade" }),
  dateTime: timestamp("dateTime", { withTimezone: true }).notNull(),
  class: varchar("class", { length: 255 }).notNull(),
  function: varchar("function", { length: 255 }).notNull(),
  errorMessage: text("errorMessage").notNull(),
  hash: varchar("hash", { length: 255 }).notNull(),
  type: varchar("type", { length: 255 }).notNull(),
  count: integer("count").default(0),
});

export type selectCameraLog = InferSelectModel<typeof cameraLogsTable>;
export type insertCameraLog = InferInsertModel<typeof cameraLogsTable>;
