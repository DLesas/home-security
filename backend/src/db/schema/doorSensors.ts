import { integer } from "drizzle-orm/pg-core";
import { pgTable, serial, varchar } from "drizzle-orm/pg-core";
import { buildingTable } from "./buildings";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const doorSensorsTable = pgTable("doorSensors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  buildingId: integer("buildingId").notNull().references(
    () => buildingTable.id,
    { onDelete: "cascade" },
  ),
});

export type selectDoorSensor = InferSelectModel<typeof doorSensorsTable>;
export type insertDoorSensor = InferInsertModel<typeof doorSensorsTable>;
