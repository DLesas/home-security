import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { pgTable, serial, varchar } from "drizzle-orm/pg-core";

export const buildingTable = pgTable("buildings", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }),
});

export type selectBuilding = InferSelectModel<typeof buildingTable>;
export type insertBuilding = InferInsertModel<typeof buildingTable>;