import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { pgTable, serial, varchar, timestamp, text } from "drizzle-orm/pg-core";

export const buildingTable = pgTable("buildings", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type selectBuilding = InferSelectModel<typeof buildingTable>;
export type insertBuilding = InferInsertModel<typeof buildingTable>;