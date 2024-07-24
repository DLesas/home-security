import { pgTable, serial, varchar } from "drizzle-orm/pg-core";

export const buildingTable = pgTable("buildings", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }),
});
