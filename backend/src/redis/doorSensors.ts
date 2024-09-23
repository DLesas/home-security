import { Repository, Schema } from "redis-om";
import { redis } from ".";

const doorSensorSchema = new Schema("doorSensors", {
  name: { type: "string" },
  externalID: { type: "string" },
  building: { type: "string" },
  armed: { type: "boolean" },
  state: { type: "string" },
  ipAddress: { type: "string" },
  macAddress: { type: "string" },
  temperature: { type: "number" },
  lastUpdated: { type: "date" },
});

export interface doorSensor {
  name: string;
  externalID: string;
  building: string;
  armed: boolean;
  state: "open" | "closed" | "unknown";
  ipAddress?: string;
  macAddress?: string;
  temperature: number;
  lastUpdated: Date;
}

export const doorSensorRepository = new Repository(
  doorSensorSchema,
  redis,
);

await doorSensorRepository.createIndex();
