import { Repository, Schema } from "redis-om";
import { redis } from "./index";
import { raiseError } from "../events/notify";

const configSchema = new Schema("config", {
  sensorWarningTemparature: { type: "number" },
  sensorCriticalTemparature: { type: "number" },
});
export interface Config {
  sensorWarningTemparature: number;
  sensorCriticalTemparature: number;
}

export const configRepository = new Repository(configSchema, redis);

export const createConfigIndex = async () => {
  try {
    await configRepository.createIndex();
  } catch (error) {
    console.error("Error creating config index:", error);
  }
};

export const setDefaultConfig = async () => {
  const config = (await configRepository
    .search()
    .returnFirst()) as Config | null;
  if (config) {
    return;
  }
  if (
    !process.env.SENSOR_WARNING_TEMPERATURE ||
    !process.env.SENSOR_CRITICAL_TEMPERATURE
  ) {
    raiseError(
      500,
      "SENSOR_WARNING_TEMPERATURE or SENSOR_CRITICAL_TEMPERATURE is not set"
    );
    return;
  }
  await configRepository.save({
    sensorWarningTemparature: parseInt(process.env.SENSOR_WARNING_TEMPERATURE!),
    sensorCriticalTemparature: parseInt(
      process.env.SENSOR_CRITICAL_TEMPERATURE!
    ),
  } as Config);
};
