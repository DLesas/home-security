import { Repository, Schema } from "redis-om";
import { redis } from ".";

const configSchema = new Schema("config", {
  sensorWarningTemparature: { type: "number" },
  sensorCriticalTemparature: { type: "number" },
});

export const configRepository = new Repository(configSchema, redis);

await configRepository.createIndex();
