/**
 * Schedule Management Redis Schemas
 *
 * Unified schedule schema enforcing complete arm/disarm cycles:
 * 1. Recurring Schedules (Daily & Weekly) - with relative day offsets
 * 2. One-Time Schedules - with explicit arm and disarm datetimes
 *
 * Every schedule contains both ARM and DISARM configurations.
 * No standalone arm-only or disarm-only schedules are allowed.
 */

import { Repository, Schema } from "redis-om";
import { redis } from "./index";

// Recurring Schedules Schema (Daily & Weekly)
const recurringScheduleSchema = new Schema("recurringSchedules", {
  id: { type: "string" },             // Unique schedule ID
  name: { type: "string" },
  sensorIDs: { type: "string[]" },

  // ARM configuration
  armTime: { type: "string" },        // "HH:MM" format (e.g., "21:00")
  armDayOffset: { type: "number" },   // Relative day: 0 = base day, 1 = next day, -1 = previous day

  // DISARM configuration
  disarmTime: { type: "string" },     // "HH:MM" format (e.g., "07:00")
  disarmDayOffset: { type: "number" }, // Relative to arm day: 0 = same day, 1 = next day, etc.

  recurrence: { type: "string" },     // 'Daily' | 'Weekly'
  days: { type: "string" },           // JSON stringified array for Weekly: ["Monday", "Wednesday"]
  active: { type: "boolean" },

  createdAt: { type: "date" },
  lastModified: { type: "date" },
});

// One-Time Schedules Schema
const oneTimeScheduleSchema = new Schema("oneTimeSchedules", {
  id: { type: "string" },             // Unique schedule ID
  name: { type: "string" },
  sensorIDs: { type: "string[]" },

  // Explicit arm and disarm datetimes
  armDateTime: { type: "date" },      // When to arm sensors
  disarmDateTime: { type: "date" },   // When to disarm sensors (can be any future time)

  createdAt: { type: "date" },
});

// TypeScript Interfaces
export interface RecurringSchedule {
  id: string;                // Unique schedule ID
  name: string;
  sensorIDs: string[];

  // Arm configuration
  armTime: string;           // "21:00" format
  armDayOffset: number;      // Relative day offset (0, 1, -1, etc.)

  // Disarm configuration
  disarmTime: string;        // "07:00" format
  disarmDayOffset: number;   // Relative to arm day (0, 1, 2, etc.)

  recurrence: "Daily" | "Weekly";
  days?: string;             // JSON stringified array for Weekly
  active: boolean;

  createdAt: Date;
  lastModified: Date;
}

export interface OneTimeSchedule {
  id: string;                // Unique schedule ID
  name: string;
  sensorIDs: string[];

  // Explicit datetimes
  armDateTime: Date;         // "2025-01-15T21:00:00Z"
  disarmDateTime: Date;      // "2025-01-18T07:00:00Z"

  createdAt: Date;
}

// Repository exports
export const recurringScheduleRepository = new Repository(
  recurringScheduleSchema,
  redis
);

export const oneTimeScheduleRepository = new Repository(
  oneTimeScheduleSchema,
  redis
);

// Index creation functions
export const createRecurringScheduleIndex = async () => {
  try {
    await recurringScheduleRepository.createIndex();
    console.log("Recurring schedule index created successfully");
  } catch (error) {
    console.error("Error creating recurring schedule index:", error);
  }
};

export const createOneTimeScheduleIndex = async () => {
  try {
    await oneTimeScheduleRepository.createIndex();
    console.log("One-time schedule index created successfully");
  } catch (error) {
    console.error("Error creating one-time schedule index:", error);
  }
};

// Combined function to create both indexes
export const createScheduleIndexes = async () => {
  await createRecurringScheduleIndex();
  await createOneTimeScheduleIndex();
};
