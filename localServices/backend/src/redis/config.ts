import { Repository, Schema } from "redis-om";
import { redis } from "./index";

const configSchema = new Schema("config", {
  sensorWarningTemparature: { type: "number" },
  sensorCriticalTemparature: { type: "number" },
});
export interface Config {
  sensorWarningTemparature: number;
  sensorCriticalTemparature: number;
}

export const configRepository = new Repository(configSchema, redis);
export const CONFIG_ENTITY_ID = "config:default";

export const createConfigIndex = async () => {
  try {
    await configRepository.createIndex();
  } catch (error) {
    console.error("Error creating config index:", error);
  }
};

export const setDefaultConfig = async () => {
  const defaultWarning = 65;
  const defaultCritical = 75;

  const warningStr = process.env.SENSOR_WARNING_TEMPERATURE;
  const criticalStr = process.env.SENSOR_CRITICAL_TEMPERATURE;

  if (!warningStr || !criticalStr) {
    console.error(
      "SENSOR_WARNING_TEMPERATURE or SENSOR_CRITICAL_TEMPERATURE is not set"
    );
  }

  const payload: Config = {
    sensorWarningTemparature: parseInt(
      (warningStr ?? String(defaultWarning)).toString()
    ),
    sensorCriticalTemparature: parseInt(
      (criticalStr ?? String(defaultCritical)).toString()
    ),
  } as Config;

  // Always save to a constant ID to avoid duplicate config entities
  await configRepository.save(CONFIG_ENTITY_ID, payload as Config);
};
