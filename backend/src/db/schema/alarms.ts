import { integer } from "drizzle-orm/pg-core";
import { pgTable, serial, varchar } from "drizzle-orm/pg-core";
import { buildingTable } from "./buildings";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const alarmsTable = pgTable("alarms", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 256 }),
	buildingId: integer("buildingId")
		.notNull()
		.references(() => buildingTable.id, { onDelete: "cascade" }),
});

export type selectDoorSensor = InferSelectModel<typeof alarmsTable>;
export type insertDoorSensor = InferInsertModel<typeof alarmsTable>;
