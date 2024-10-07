import { boolean, integer, text, timestamp } from "drizzle-orm/pg-core";
import { pgTable, serial, varchar } from "drizzle-orm/pg-core";
import { buildingTable } from "./buildings.js";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const sensorsTable = pgTable("sensors", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  buildingId: text("buildingId").notNull().references(
    () => buildingTable.id,
    { onDelete: "cascade" },
  ),
  createdAt: timestamp("createdAt").defaultNow(),
  deleted: boolean("deleted").default(false),
});

export type selectDoorSensor = InferSelectModel<typeof sensorsTable>;
export type insertDoorSensor = InferInsertModel<typeof sensorsTable>;
