import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  bigserial,
  pgEnum,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { index } from "drizzle-orm/pg-core";

export const actionEnum = pgEnum("actions", ["GET", "POST", "DELETE", "PUT"]);
export const connectionEnum = pgEnum("connection", ["http", "socket"]);

export const accessLogsTable = pgTable("accessLogs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  endpoint: varchar("endpoint", { length: 256 }).notNull(),
  queryString: varchar("queryString", { length: 2048 }),
  action: actionEnum("action").notNull(),
  connection: connectionEnum("connection").notNull(),
  clientIp: varchar("clientIp", { length: 256 }).notNull(),
  userAgent: varchar("userAgent", { length: 512 }),
  dateTime: timestamp("dateTime", { withTimezone: true }).defaultNow(),
});

export type selectGeneralLog = InferSelectModel<typeof accessLogsTable>;
export type insertGeneralLog = InferInsertModel<typeof accessLogsTable>;
