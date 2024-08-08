import { Repository, Schema } from "redis-om";
import { redis } from ".";

const doorSensorStateSchema = new Schema("doorSensorState", {
  name: { type: "string" },
  building: { type: "string" },
  armed: { type: "boolean" },
  state: { type: "string" },
  ipAddress: { type: "string" },
  temperature: { type: "number" },
  date: { type: "date" },
});

export interface doorSensorState {
  name: string;
  building: string;
  armed: boolean;
  state: "open" | "closed";
  ipAddress: string;
  temperature: number;
  date: Date;
}

export const doorSensorStateRepository = new Repository(
  doorSensorStateSchema,
  redis,
);

await doorSensorStateRepository.createIndex();
