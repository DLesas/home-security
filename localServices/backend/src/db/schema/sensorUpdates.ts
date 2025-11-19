import { bigserial, integer, numeric, pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { sensorsTable } from "./sensors";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const doorSensorStateEnum = pgEnum("state", ["open", "closed", "unknown"]);

export const sensorUpdatesTable = pgTable("sensorUpdates", {
	id: bigserial("id", { mode: "number" }).notNull(),
	sensorId: text("sensorId")
		.notNull()
		.references(() => sensorsTable.id, { onDelete: "cascade" }),
	state: doorSensorStateEnum("state").notNull(),
	temperature: numeric("temperature", { precision: 5, scale: 2 }),
	voltage: numeric("voltage", { precision: 5, scale: 2 }),
	frequency: integer("frequency"),
	dateTime: timestamp("dateTime", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
	pk: primaryKey({ columns: [table.id, table.dateTime] })
}));

export type selectSensorUpdate = InferSelectModel<typeof sensorUpdatesTable>;
export type insertSensorUpdate = InferInsertModel<typeof sensorUpdatesTable>;
