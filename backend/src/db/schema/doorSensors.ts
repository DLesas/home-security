import { integer, text, timestamp } from "drizzle-orm/pg-core";
import { pgTable, serial, varchar } from "drizzle-orm/pg-core";
import { buildingTable } from "./buildings.js";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const doorSensorsTable = pgTable("doorSensors", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  buildingId: text("buildingId").notNull().references(
    () => buildingTable.id,
    { onDelete: "cascade" },
  ),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type selectDoorSensor = InferSelectModel<typeof doorSensorsTable>;
export type insertDoorSensor = InferInsertModel<typeof doorSensorsTable>;
