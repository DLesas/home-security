import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  bigserial,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { index } from "drizzle-orm/pg-core";

export const eventLogsTable = pgTable("eventLogs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  type: varchar("type", { length: 32 }).notNull().$type<
    "info" | "error" | "warning" | "critical"
  >().notNull(),
  message: text("message").notNull(),
  dateTime: timestamp("dateTime").defaultNow(),
}, (table) => {
  return {
    dateTimeIdx: index("dateTimeIdx").on(table.dateTime),
  };
});

export type selectEventLog = InferSelectModel<typeof eventLogsTable>;
export type insertEventLog = InferInsertModel<typeof eventLogsTable>;
