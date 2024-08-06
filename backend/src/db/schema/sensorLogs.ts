import {
  bigserial,
  integer,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { doorSensorsTable } from "./doorSensors";
import { index } from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const doorSensorStateEnum = pgEnum("state", [
  "open",
  "closed",
  "unknown",
]);

export const sensorLogsTable = pgTable("sensorLogs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  sensorId: integer("sensorId").notNull().references(
    () => doorSensorsTable.id,
    { onDelete: "cascade" },
  ),
  state: doorSensorStateEnum("state").notNull(),
  temperature: numeric("temperature", { precision: 5, scale: 2 }).notNull(),
  dateTime: timestamp("dateTime").defaultNow(),
}, (table) => {
  return {
    dateTimeIdx: index("dateTimeIdx").on(table.dateTime),
  };
});

export type selectSensorLog = InferSelectModel<typeof sensorLogsTable>;
export type insertSensorLog = InferInsertModel<typeof sensorLogsTable>;
