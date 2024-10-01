import { bigserial, integer, numeric, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { doorSensorsTable } from "./doorSensors.js";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const doorSensorStateEnum = pgEnum("state", ["open", "closed", "unknown"]);

export const sensorUpdatesTable = pgTable("sensorUpdates", {
	id: bigserial("id", { mode: "number" }).primaryKey(),
	sensorId: text("sensorId")
		.notNull()
		.references(() => doorSensorsTable.id, { onDelete: "cascade" }),
	state: doorSensorStateEnum("state").notNull(),
	temperature: numeric("temperature", { precision: 5, scale: 2 }).notNull(),
	dateTime: timestamp("dateTime", { withTimezone: true }).defaultNow(),
});

export type selectSensorUpdate = InferSelectModel<typeof sensorUpdatesTable>;
export type insertSensorUpdate = InferInsertModel<typeof sensorUpdatesTable>;
