import { type Alarm, alarmRepository } from "./redis/alarms";
import { alarmTimeoutManager } from "./alarmTimeoutManager";
import { ALARM_COOLDOWN_SECONDS } from "./config";
import { Result, ok, err, ResultAsync } from "neverthrow";

/**
 * Alarm Functions with Cooldown Protection
 *
 * This module implements alarm state management with cooldown protection.
 * Timeout functionality is handled by the AlarmTimeoutManager singleton.
 *
 * Cooldown: When an alarm is turned off, it cannot be turned on again for
 * ALARM_COOLDOWN_SECONDS (default: 30s). This prevents issues with devices that may
 * send multiple "open" state signals despite being opened only once.
 *
 * Auto-timeout: Managed by AlarmTimeoutManager - each alarm can have its own timeout duration.
 * Set alarm.autoTurnOffSeconds to desired timeout (0 = no timeout).
 */

// Define the expected response type
interface AlarmResponse {
  state: string;
  temperature: number;
  voltage: number;
  frequency: number;
}

/**
 * Changes the state of all alarms supplied via the params to the specified state.
 * Implements a configurable cooldown after alarms are turned off before they can be turned on again.
 *
 * @param {Alarm[] | []} alarms - The array of alarms to change the state of.
 * @param {"on" | "off"} state - The state to change the alarms to.
 * @return {ResultAsync<boolean[], string>} - A ResultAsync that resolves to an array of results from the promises of sending the http requests to trigger the alarms.
 */
export function changeAlarmState(
  alarms: Alarm[] | [],
  state: "on" | "off"
): ResultAsync<boolean[], string> {
  return ResultAsync.fromPromise(
    (async () => {
      const triggerPromises: Promise<Result<boolean, string>>[] = [];

      for (let index = 0; index < alarms.length; index++) {
        const element = alarms[index];
        if (element.ipAddress && element.port) {
          // Check cooldown for turning alarms on
          if (state === "on") {
            const now = new Date();
            if (element.cooldownUntil && now < element.cooldownUntil) {
              const remainingSeconds = Math.ceil(
                (element.cooldownUntil.getTime() - now.getTime()) / 1000
              );
              console.log(
                `[COOLDOWN] Alarm ${element.name} is in cooldown. Cannot turn on for ${remainingSeconds} more seconds.`
              );
              continue; // Skip this alarm
            }
          }

          const ipaddr = `http://${element.ipAddress}:${element.port}`;
          const url = state === "on" ? `${ipaddr}/on` : `${ipaddr}/off`;

          const promise = fetch(url, { method: "POST" })
            .then(async (response): Promise<Result<boolean, string>> => {
              if (!response.ok) {
                return err(
                  `Failed to trigger alarm ${element.name}. Status: ${response.status}`
                );
              }
              const alarmResponse = (await response.json()) as AlarmResponse;
              const saved = await saveAlarmState(element, alarmResponse, state);
              return ok(saved);
            })
            .catch((error): Result<boolean, string> => {
              return err(`Network error triggering alarm ${element.name}: ${error}`);
            });

          triggerPromises.push(promise);
        }
      }

      const results = await Promise.all(triggerPromises);

      // Check if any failed
      const failures = results.filter((r) => r.isErr());
      if (failures.length > 0) {
        const errorMessages = failures.map((r) => r.isErr() ? r.error : "").join(", ");
        return err(errorMessages) as any;
      }

      return results.map((r) => r.isOk() ? r.value : false);
    })(),
    (error) => String(error)
  );
}

/**
 * Saves the updated state of an alarm based on the response from the alarm device to redis.
 * Sets cooldown timestamp when alarms are turned off and delegates timeout management to AlarmTimeoutManager.
 *
 * @param {Alarm} alarm - The redis alarm object to be updated.
 * @param {AlarmResponse} res - The response object containing the new state of the alarm relay.
 * @param {"on" | "off"} state - The state that was requested for the alarm.
 * @returns {Promise<Boolean>} A promise that resolves to true if the alarm state is successfully saved.
 */
async function saveAlarmState(
  alarm: Alarm,
  res: AlarmResponse,
  state: "on" | "off"
): Promise<Boolean> {
  res.state == "on" ? (alarm.playing = true) : (alarm.playing = false);
  alarm.temperature = res.temperature;
  alarm.voltage = res.voltage;
  alarm.frequency = res.frequency;
  alarm.lastUpdated = new Date();

  // Handle timeout and cooldown management
  if (state === "off") {
    // Clear auto-timeout when alarm is manually turned off
    alarmTimeoutManager.clearAlarmTimeout(alarm.externalID);

    // Set cooldown when alarm is turned off
    const cooldownUntil = new Date();
    cooldownUntil.setSeconds(
      cooldownUntil.getSeconds() + ALARM_COOLDOWN_SECONDS
    );
    alarm.cooldownUntil = cooldownUntil;
    console.log(
      `[COOLDOWN] Alarm ${
        alarm.name
      } cooldown set until ${cooldownUntil.toISOString()} (${ALARM_COOLDOWN_SECONDS}s duration)`
    );
  } else if (state === "on") {
    // Clear cooldown when alarm is successfully turned on
    alarm.cooldownUntil = undefined;
    console.log(`[COOLDOWN] Alarm ${alarm.name} cooldown cleared`);

    // Set auto-timeout when alarm is turned on (managed by singleton)
    await alarmTimeoutManager.setAlarmTimeout(alarm);
  }

  // Save with explicit ID to avoid creating duplicate entities when alarm is a plain object
  await alarmRepository.save(alarm.externalID, alarm as Alarm);
  return true;
}
