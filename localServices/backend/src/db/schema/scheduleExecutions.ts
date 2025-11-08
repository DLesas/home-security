import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  bigserial,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  json,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

export const scheduleActionEnum = pgEnum("scheduleAction", ["Arm", "Disarm"]);
export const scheduleTypeEnum = pgEnum("scheduleType", [
  "recurring",
  "oneTime",
]);
export const scheduleRecurrenceEnum = pgEnum("scheduleRecurrence", [
  "Daily",
  "Weekly",
]);

export const scheduleExecutionsTable = pgTable("scheduleExecutions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),

  // Schedule identification
  scheduleId: varchar("scheduleId", { length: 255 }).notNull(),
  scheduleName: varchar("scheduleName", { length: 255 }).notNull(),
  scheduleType: scheduleTypeEnum("scheduleType").notNull(),

  // Which part of the schedule executed (Arm or Disarm)
  executionType: scheduleActionEnum("executionType").notNull(),

  // Sensors involved
  sensorIds: json("sensorIds").$type<string[]>().notNull(),

  // Recurring schedule fields (nullable for one-time schedules)
  armTime: varchar("armTime", { length: 8 }), // "21:00"
  armDayOffset: integer("armDayOffset"),
  disarmTime: varchar("disarmTime", { length: 8 }), // "07:00"
  disarmDayOffset: integer("disarmDayOffset"),
  recurrence: scheduleRecurrenceEnum("recurrence"),
  days: json("days").$type<string[]>(), // For weekly: ['Monday', 'Wednesday']
  active: boolean("active"),

  // One-time schedule fields (nullable for recurring schedules)
  armDateTime: timestamp("armDateTime", { withTimezone: true }),
  disarmDateTime: timestamp("disarmDateTime", { withTimezone: true }),

  // Execution results
  executedAt: timestamp("executedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  sensorsAffected: json("sensorsAffected")
    .$type<{ id: string; name: string; building: string; state: string }[]>()
    .notNull(),
  successfulSensors: json("successfulSensors").$type<string[]>().notNull(),
  failedSensors: json("failedSensors").$type<string[]>().notNull(),
  retriedSensors: json("retriedSensors").$type<string[]>(), // Sensors that needed retry logic

  // Audit fields
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
});

export type selectScheduleExecution = InferSelectModel<
  typeof scheduleExecutionsTable
>;
export type insertScheduleExecution = InferInsertModel<
  typeof scheduleExecutionsTable
>;
