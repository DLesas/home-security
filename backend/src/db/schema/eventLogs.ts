import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  bigserial,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const eventTypeEnum = pgEnum("eventType", [
  "info",
  "warning",
  "critical",
]);

export const eventLogsTable = pgTable("eventLogs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  type: eventTypeEnum("type").notNull(),
  message: text("message").notNull(),
  dateTime: timestamp("dateTime", { withTimezone: true }).defaultNow(),
});

export type selectEventLog = InferSelectModel<typeof eventLogsTable>;
export type insertEventLog = InferInsertModel<typeof eventLogsTable>;
