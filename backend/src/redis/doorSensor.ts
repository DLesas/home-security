import { Repository, Schema } from "redis-om";
import { redis } from ".";

const sensorSchema = new Schema("doorSensors", {
  name: { type: "string" },
  building: { type: "string" },
  ipAddress: { type: "string" },
  macAddress: { type: "string" },
  created: { type: "date" },
});

export interface DoorSensor {
  name: string;
  building: string;
  ipAddress: string;
  macAddress: string;
  created: Date;
}

export const doorSensorsRepository = new Repository(sensorSchema, redis);

await doorSensorsRepository.createIndex();
