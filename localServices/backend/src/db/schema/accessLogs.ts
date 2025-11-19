import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  bigserial,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
  jsonb,
} from "drizzle-orm/pg-core";

export const actionEnum = pgEnum("actions", ["GET", "POST", "DELETE", "PUT"]);
export const connectionEnum = pgEnum("connection", ["http", "socket"]);

export const accessLogsTable = pgTable("accessLogs", {
  id: bigserial("id", { mode: "number" }).notNull(),
  endpoint: varchar("endpoint", { length: 256 }).notNull(),
  queryString: varchar("queryString", { length: 2048 }),
  body: jsonb("body"),
  action: actionEnum("action").notNull(),
  connection: connectionEnum("connection").notNull(),
  clientIp: varchar("clientIp", { length: 256 }).notNull(),
  userAgent: varchar("userAgent", { length: 512 }),
  dateTime: timestamp("dateTime", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.id, table.dateTime] })
}));

export type selectGeneralLog = InferSelectModel<typeof accessLogsTable>;
export type insertGeneralLog = InferInsertModel<typeof accessLogsTable>;
