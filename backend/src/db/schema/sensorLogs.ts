import { bigserial, integer, numeric, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { doorSensorsTable } from "./doorSensors";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const doorSensorStateEnum = pgEnum("state", ["open", "closed", "unknown"]);

export const sensorLogsTable = pgTable("sensorLogs", {
	id: bigserial("id", { mode: "number" }).primaryKey(),
	sensorId: integer("sensorId")
		.notNull()
		.references(() => doorSensorsTable.id, { onDelete: "cascade" }),
	dateTime: timestamp("dateTime", { withTimezone: true }).notNull(),
    class: varchar("class", { length: 255 }).notNull(),
    function: varchar("function", { length: 255 }).notNull(),
    errorMessage: text("errorMessage").notNull(),
    hash: varchar("hash", { length: 255 }).notNull(),
    count: integer("count").default(0),
});

export type selectSensorLog = InferSelectModel<typeof sensorLogsTable>;
export type insertSensorLog = InferInsertModel<typeof sensorLogsTable>;