import { raiseError } from "./errorHandling";
import { changeAlarmState } from "./alarmFuncs";
import { raiseEvent } from "./notifiy";
import { type Alarm, alarmRepository } from "./redis/alarms";
import { type Config, configRepository } from "./redis/config";
import type { doorSensorState } from "./redis/doorSensorState";

/**
 * Checks the state of a door sensor and triggers all alarms if the sensor is armed and the state is open.
 * @param {doorSensorState} previousState - The previous state of the door sensor.
 * @param {"open" | "closed" | "unknown"} state - The current state of the door sensor.
 * @return {Promise<void>} A promise that resolves when all alarms are triggered and the event is raised/logged.
 */
export async function checkSensorState(
  previousState: doorSensorState,
  state: "open" | "closed" | "unknown",
) {
  if (previousState.armed && state === "open") {
    const alarms = await alarmRepository.search().returnAll() as Alarm[] | [];
    const alarmpromises = [];
    alarmpromises.push(changeAlarmState(alarms, "on"));
    alarmpromises.push(raiseEvent(
      "critical",
      `Alarm triggered by sensor at ${previousState.name} in ${previousState.building} with ip address of ${previousState.ipAddress}. \n This was detected at ${
        new Date().toString()
      }`,
    ));
    await Promise.all(alarmpromises);
  }
}

/**
 * Checks the temperature of a door sensor and raises an event if the temperature exceeds the configured critical or warning thresholds.
 *
 * @param {number} temperature - The current temperature of the door sensor.
 * @param {DoorSensor} sensor - The relevant door sensor info.
 * @return {Promise<void>} A promise that resolves when the event is raised/logged.
 */
export async function checkSensorTemperature(
  temperature: number,
  sensor: doorSensorState,
) {
  const config = await configRepository.search().returnFirst() as Config | null;
  if (config === null) {
    raiseError();
    return;
  }
  const startText =
    `Sensor at ${sensor.name} in ${sensor.building} is above configured`;
  const endText =
    `, current temperature is ${temperature}°C. \n This was detected at ${
      new Date().toString()
    }. \n These devices are rated to work between -20C and 80C.`;
  if (temperature > config.sensorCriticalTemparature) {
    await raiseEvent(
      "critical",
      startText + `critical temperature ${config.sensorCriticalTemparature}°C` +
        endText,
    );
    return;
  }
  if (temperature > config.sensorWarningTemparature) {
    await raiseEvent(
      "warning",
      startText + `warning temperature ${config.sensorWarningTemparature}°C` +
        endText,
    );
    return;
  }
}
