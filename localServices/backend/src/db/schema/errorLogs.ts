import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  bigserial,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { eventTypeEnum } from "./eventLogs";

export const errorLogsTable = pgTable("errorLogs", {
  id: bigserial("id", { mode: "number" }).notNull(),
  endpoint: varchar("endpoint", { length: 256 }).notNull(),
  errorTrace: varchar("errorTrace", { length: 2048 }).notNull(),
  level: eventTypeEnum("level").notNull(),
  dateTime: timestamp("dateTime", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.id, table.dateTime] })
}));

export type selectGeneralLog = InferSelectModel<typeof errorLogsTable>;
export type insertGeneralLog = InferInsertModel<typeof errorLogsTable>;
