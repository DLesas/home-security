import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  bigserial,
  pgEnum,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const errorLogsTable = pgTable("errorLogs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  endpoint: varchar("endpoint", { length: 256 }).notNull(),
  errorTrace: varchar("errorTrace", { length: 2048 }).notNull(),
  dateTime: timestamp("dateTime", { withTimezone: true }).defaultNow(),
});

export type selectGeneralLog = InferSelectModel<typeof errorLogsTable>;
export type insertGeneralLog = InferInsertModel<typeof errorLogsTable>;
