import { bigserial, integer, numeric, pgEnum, pgTable, primaryKey, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sensorsTable } from "./sensors";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const sensorLogsTable = pgTable("sensorLogs", {
	id: bigserial("id", { mode: "number" }).notNull(),
	sensorId: text("sensorId")
		.notNull()
		.references(() => sensorsTable.id, { onDelete: "cascade" }),
	dateTime: timestamp("dateTime", { withTimezone: true }).notNull(),
    class: varchar("class", { length: 255 }).notNull(),
    function: varchar("function", { length: 255 }).notNull(),
    errorMessage: text("errorMessage").notNull(),
    hash: varchar("hash", { length: 255 }).notNull(),
    type: varchar("type", { length: 255 }).notNull(),
    count: integer("count").default(0),
    last_seen: timestamp("last_seen", { withTimezone: true }),
}, (table) => ({
	pk: primaryKey({ columns: [table.id, table.dateTime] })
}));

export type selectSensorLog = InferSelectModel<typeof sensorLogsTable>;
export type insertSensorLog = InferInsertModel<typeof sensorLogsTable>;