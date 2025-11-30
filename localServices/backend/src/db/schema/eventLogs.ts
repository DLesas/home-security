import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  bigserial,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const eventTypeEnum = pgEnum("eventType", [
  "debug",
  "info",
  "warning",
  "critical",
]);


type SystemPrefix = "backend" | "advertisementService" | "eventService" | "cameraIngestion";

// Use it in the template literal type
type SystemFormat = `${SystemPrefix}:${string}`;

export const eventLogsTable = pgTable("eventLogs", {
  id: bigserial("id", { mode: "number" }).notNull(),
  type: eventTypeEnum("type").notNull(),
  system: varchar("system", { length: 255 })
    .notNull()
    .$type<SystemFormat>(),
  message: text("message").notNull(),
  dateTime: timestamp("dateTime", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.id, table.dateTime] })
}));

export type selectEventLog = InferSelectModel<typeof eventLogsTable>;
export type insertEventLog = InferInsertModel<typeof eventLogsTable>;
