import { bigserial, integer, numeric, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { alarmsTable } from "./alarms.js";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const alarmLogsTable = pgTable("alarmLogs", {
	id: bigserial("id", { mode: "number" }).primaryKey(),
	alarmId: text("alarmId")
		.notNull()
		.references(() => alarmsTable.id, { onDelete: "cascade" }),
	dateTime: timestamp("dateTime", { withTimezone: true }).notNull(),
    class: varchar("class", { length: 255 }).notNull(),
    function: varchar("function", { length: 255 }).notNull(),
    errorMessage: text("errorMessage").notNull(),
    hash: varchar("hash", { length: 255 }).notNull(),
    type: varchar("type", { length: 255 }).notNull(),
    count: integer("count").default(0),
});

export type selectAlarmLog = InferSelectModel<typeof alarmLogsTable>;
export type insertAlarmLog = InferInsertModel<typeof alarmLogsTable>;