import { Repository, Schema } from "redis-om";
import { redis } from ".";

const doorSensorStateSchema = new Schema("doorSensorState", {
  name: { type: "string" },
  building: { type: "string" },
  armed: { type: "boolean" },
  ipAddress: { type: "string" },
  date: { type: "date" },
});

export const doorSensorStateRepository = new Repository(doorSensorStateSchema, redis);

await doorSensorStateRepository.createIndex();
