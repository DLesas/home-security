import { boolean, integer, text, timestamp } from "drizzle-orm/pg-core";
import { pgTable, serial, varchar } from "drizzle-orm/pg-core";
import { buildingTable } from "./buildings";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";
    
export const camerasTable = pgTable("cameras", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 256 }),
  buildingId: text("buildingId")
    .references(() => buildingTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow(),
  port: integer("port").notNull(),
  deleted: boolean("deleted").default(false),
});

export type selectCamera = InferSelectModel<typeof camerasTable>;
export type insertCamera = InferInsertModel<typeof camerasTable>;
