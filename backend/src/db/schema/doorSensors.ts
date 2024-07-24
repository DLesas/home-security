import { integer } from "drizzle-orm/pg-core";
import { pgTable, serial, varchar } from "drizzle-orm/pg-core";
import { buildingTable } from "./buildings";

export const doorSensorsTable = pgTable("doorSensors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }),
  buildingId: integer("buildingId").notNull().references(
    () => buildingTable.id,
    { onDelete: "cascade" },
  ),
});
