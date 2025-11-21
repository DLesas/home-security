import { Repository, Schema } from "redis-om";
import { redis } from "./index";

const alarmSchema = new Schema("alarms", {
  name: { type: "string" },
  externalID: { type: "string" },
  playing: { type: "boolean" },
  building: { type: "string" },
  state: { type: "string" },
  ipAddress: { type: "string" },
  port: { type: "number" },
  macAddress: { type: "string" },
  temperature: { type: "number" },
  voltage: { type: "number" },
  frequency: { type: "number" },
  expectedSecondsUpdated: { type: "number" },
  lastUpdated: { type: "date" },
  cooldownUntil: { type: "date" },
  autoTurnOffSeconds: { type: "number" },
  timeoutMonitoringStarted: { type: "boolean" },
});

export const alarmRepository = new Repository(alarmSchema, redis);

export interface Alarm {
  name: string;
  externalID: string;
  playing: boolean;
  building: string;
  state: string;
  ipAddress?: string;
  port: number;
  macAddress?: string;
  temperature?: number;
  voltage?: number;
  frequency?: number;
  expectedSecondsUpdated: number;
  lastUpdated: Date;
  cooldownUntil?: Date;
  autoTurnOffSeconds?: number; // Individual timeout setting (0 = no timeout)
  timeoutMonitoringStarted?: boolean;
}

export const createAlarmIndex = async () => {
  try {
    await alarmRepository.createIndex();
  } catch (error) {
    console.error("Error creating alarm index:", error);
  }
};
