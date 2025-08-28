/**
 * Schedule Management Redis Schemas
 *
 * Two separate Redis repositories for managing security system schedules:
 * 1. Recurring Schedules (Daily & Weekly)
 * 2. One-Time Schedules
 */

import { Repository, Schema } from "redis-om";
import { redis } from "./index";

// Recurring Schedules Schema (Daily & Weekly)
const recurringScheduleSchema = new Schema("recurringSchedules", {
  name: { type: "string" },
  sensorIDs: { type: "string[]" },
  action: { type: "string" }, // 'Arm' | 'Disarm'
  time: { type: "string" }, // "HH:MM" format (e.g., "09:30")
  recurrence: { type: "string" }, // 'Daily' | 'Weekly'
  days: { type: "string" }, // JSON stringified array for Weekly: ["Monday", "Wednesday"]
  active: { type: "boolean" },
  createdAt: { type: "date" },
  lastModified: { type: "date" },
});

// One-Time Schedules Schema
const oneTimeScheduleSchema = new Schema("oneTimeSchedules", {
  name: { type: "string" },
  sensorIDs: { type: "string[]" },
  action: { type: "string" }, // 'Arm' | 'Disarm'
  dateTime: { type: "date" }, // Combined date and time
  createdAt: { type: "date" },
});

// TypeScript Interfaces
export interface RecurringSchedule {
  name: string;
  sensorIDs: string[];
  action: "Arm" | "Disarm";
  time: string; // "09:30" format
  recurrence: "Daily" | "Weekly";
  days?: string[]; // Only for Weekly: ['Monday', 'Wednesday', 'Friday']
  active: boolean;
  createdAt: Date;
  lastModified: Date;
}

export interface OneTimeSchedule {
  name: string;
  sensorIDs: string[];
  action: "Arm" | "Disarm";
  dateTime: Date; // Combined date and time: 2024-03-15T09:30:00Z
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
