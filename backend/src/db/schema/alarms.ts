import { boolean, integer, text, timestamp } from "drizzle-orm/pg-core";
import { pgTable, serial, varchar } from "drizzle-orm/pg-core";
import { buildingTable } from "./buildings.js";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const alarmsTable = pgTable("alarms", {
	id: text("id").primaryKey(),
	name: varchar("name", { length: 256 }),
	buildingId: text("buildingId")
		.notNull()
		.references(() => buildingTable.id, { onDelete: "cascade" }),
	createdAt: timestamp("createdAt").defaultNow(),
	port: integer("port").notNull(),
	deleted: boolean("deleted").default(false),
});

export type selectDoorSensor = InferSelectModel<typeof alarmsTable>;
export type insertDoorSensor = InferInsertModel<typeof alarmsTable>;
