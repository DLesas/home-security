import { raiseError } from "./notifiy";
import { changeAlarmState } from "./alarmFuncs";
import { raiseEvent } from "./notifiy";
import { type Alarm, alarmRepository } from "./redis/alarms";
import { type Config, configRepository } from "./redis/config";
import { type doorSensor, doorSensorRepository } from "./redis/doorSensors";
import { db } from "./db/db";
import { sensorUpdatesTable } from "./db/schema/sensorUpdates";

interface sensorResponse {
  state: string;
  temperature: number;
  voltage: number;
  frequency: number;
}

/**
 * Checks the state of a door sensor and triggers all alarms if the sensor is armed and the state is open.
 * @param {doorSensor} previousState - The previous state of the door sensor.
 * @param {"open" | "closed" | "unknown"} state - The current state of the door sensor.
 * @return {Promise<void>} A promise that resolves when all alarms are triggered and the event is raised/logged.
 */
export async function checkSensorState(
  previousState: doorSensor,
  state: "open" | "closed" | "unknown"
): Promise<void> {
  if (
    previousState.armed &&
    state === "open" &&
    previousState.state !== "open"
  ) {
    const alarms = (await alarmRepository.search().returnAll()) as Alarm[] | [];
    const alarmpromises = [];
    alarmpromises.push(changeAlarmState(alarms, "on"));
    alarmpromises.push(
      raiseEvent(
        "critical",
        `Alarm triggered by sensor at ${previousState.name} in ${
          previousState.building
        } with ip address of ${
          previousState.ipAddress
        }. \n This was detected at ${new Date().toString()}`
      )
    );
    await Promise.all(alarmpromises);
  }
}

/**
 * Checks the temperature of a door sensor and raises an event if the temperature exceeds the configured critical or warning thresholds.
 *
 * @param {number} temperature - The current temperature of the door sensor.
 * @param {doorSensor} sensor - The relevant door sensor info.
 * @return {Promise<void>} A promise that resolves when the event is raised/logged.
 */
export async function checkSensorTemperature(
  temperature: number,
  sensor: doorSensor
): Promise<void> {
  const config = (await configRepository
    .search()
    .returnFirst()) as Config | null;
  if (!config) {
    raiseError(500, "No config found");
    return;
  }
  const startText = `Sensor at ${sensor.name} in ${sensor.building} is above configured`;
  const endText = `, current temperature is ${temperature}°C. \n This was detected at ${new Date().toString()}. \n These devices are rated to work between -20C and 80C.`;
  if (temperature > config.sensorCriticalTemparature) {
    await raiseEvent(
      "critical",
      startText +
        `critical temperature ${config.sensorCriticalTemparature}°C` +
        endText
    );
    return;
  }
  if (temperature > config.sensorWarningTemparature) {
    await raiseEvent(
      "warning",
      startText +
        `warning temperature ${config.sensorWarningTemparature}°C` +
        endText
    );
    return;
  }
  return;
}

/**
 * Changes the armed status of multiple door sensors and then checks if alarms need to be triggered.
 *
 * @param {doorSensor[]} sensors - The array of door sensors to change the armed status of.
 * @param {boolean} armed - The new armed status of the door sensors.
 * @return {Promise<any[]>} A promise that resolves to an array of results from the promises of saving the door sensors to redis.
 */
export async function changeSensorStatus(
  sensors: doorSensor[],
  armed: boolean
): Promise<any[]> {
  const savePromises = [];
  for (const sensor of sensors) {
    sensor.armed = armed;
    savePromises.push(doorSensorRepository.save(sensor));
  }
  const res = await Promise.all(savePromises);
  const checkPromises = [];
  const raisePromises = [];
  // This is necessary to trigger the alarms based on a change
  // in armed status (e.g. door open and user changes status to armed)
  for (const sensor of sensors) {
    checkPromises.push(checkSensorState(sensor, sensor.state));
    // TODO: raise events in batches
    raisePromises.push(
      raiseEvent(
        "info",
        `Sensor at ${sensor.name} in ${sensor.building} was ${
          sensor.armed ? "armed" : "disarmed"
        }`
      )
    );
  }
  await Promise.all(checkPromises);
  // not necessary to await raise events promises as they
  // can happen in background so we return to user quickly
  return res;
}

/**
 * Changes the status of multiple door sensors to unknown.
 *
 * @param {doorSensor[]} sensors - The array of door sensors to change the status of.
 * @return {Promise<any[]>} A promise that resolves to an array of results from the promises of saving the door sensors to redis.
 */
export async function setSensorStatusUnknown(
  sensors: doorSensor[]
): Promise<any[]> {
  const savePromises = [];
  for (const sensor of sensors) {
    sensor.state = "unknown";
    savePromises.push(doorSensorRepository.save(sensor));
  }
  const res = await Promise.all(savePromises);
  return res;
}

/**
 * Updates the state and temperature of a door sensor, also checks if any alarms need to be triggered or if the temperature is too high.
 *
 * @param {object} params - An object containing the state, temperature, voltage, frequency, and sensor ID of the door sensor that triggered this endpoint.
 * @param {("open" | "closed" | "unknown")} params.state - The new state of the door sensor.
 * @param {number} params.temperature - The current temperature of the door sensor in degrees Celsius.
 * @param {number | null | undefined} params.voltage - The current voltage of the door sensor (optional).
 * @param {number | null | undefined} params.frequency - The current frequency of the door sensor (optional).
 * @param {string} params.sensorId - The unique identifier of the door sensor.
 * @return {Promise<void>} A promise that resolves when the update of redis is complete.
 * @throws {Error} If the sensor with the given ID is not found.
 */
export async function DoorSensorUpdate({
  state,
  temperature,
  voltage,
  frequency,
  sensorId,
}: {
  state: "open" | "closed" | "unknown";
  temperature: number;
  voltage: number | null | undefined;
  frequency: number | null | undefined;
  sensorId: string;
}): Promise<void> {
  const currentState = (await doorSensorRepository
    .search()
    .where("externalID")
    .eq(sensorId)
    .returnFirst()) as doorSensor | null;
  if (!currentState) {
    const err = raiseError(404, `Sensor with Id ${sensorId} not found`);
    throw err;
  }
  checkSensorState(currentState, state);
  checkSensorTemperature(temperature, currentState);
  currentState.state = state;
  currentState.temperature = temperature;
  currentState.voltage = voltage ? voltage : undefined;
  currentState.frequency = frequency ? frequency : undefined;
  currentState.lastUpdated = new Date();
  await doorSensorRepository.save(currentState);
  // not awaiting as server is running continously so this will happen in background
  db.insert(sensorUpdatesTable).values({
    sensorId: currentState.externalID,
    state: state,
    temperature: temperature.toString(),
    voltage: voltage ? voltage.toString() : null,
    frequency: frequency,
  });
}
