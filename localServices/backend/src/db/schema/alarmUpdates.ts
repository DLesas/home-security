import {
  bigserial,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { alarmsTable } from "./alarms";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { ALARM_STATES } from "../shared/alarm";

export const alarmStateEnum = pgEnum("alarmState", [...ALARM_STATES]);

export const alarmUpdatesTable = pgTable("alarmUpdates", {
  id: bigserial("id", { mode: "number" }).notNull(),
  alarmId: text("alarmId")
    .notNull()
    .references(() => alarmsTable.id, { onDelete: 'set null' }),
  state: alarmStateEnum("state").notNull(),
  temperature: numeric("temperature", { precision: 5, scale: 2 }),
  voltage: numeric("voltage", { precision: 5, scale: 2 }),
  frequency: integer("frequency"),
  dateTime: timestamp("dateTime", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.id, table.dateTime] })
}));

export type selectAlarmUpdate = InferSelectModel<typeof alarmUpdatesTable>;
export type insertAlarmUpdate = InferInsertModel<typeof alarmUpdatesTable>;
