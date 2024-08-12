import { Repository, Schema } from "redis-om";
import { redis } from ".";

const configSchema = new Schema("config", {
  sensorWarningTemparature: { type: "number" },
  sensorCriticalTemparature: { type: "number" },
  pushTokens: { type: "string[]" },
});

export interface Config {
  sensorWarningTemparature: number;
  sensorCriticalTemparature: number;
  pushTokens: string[];
}

export const configRepository = new Repository(configSchema, redis);

await configRepository.createIndex();
