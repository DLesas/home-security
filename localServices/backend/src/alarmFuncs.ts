import { type Alarm, alarmRepository } from "./redis/alarms";
import { ALARM_COOLDOWN_SECONDS } from "./config";

/**
 * Alarm Functions with Cooldown Protection
 *
 * This module implements a configurable cooldown mechanism to prevent rapid alarm
 * activation/deactivation cycles. When an alarm is turned off, it cannot be
 * turned on again for ALARM_COOLDOWN_SECONDS (default: 30s). This prevents issues
 * with devices that may send multiple "open" state signals despite being opened only once.
 *
 * The cooldown duration is controlled by the ALARM_COOLDOWN_SECONDS environment variable.
 * The cooldown is stored in Redis and persists across service restarts.
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
 * @return {Boolean[]} - A promise that resolves to an array of results from the promises of sending the http requests to trigger the alarms.
 */
export async function changeAlarmState(
  alarms: Alarm[] | [],
  state: "on" | "off"
) {
  const triggerPromises = [];
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
      const promise: Promise<Boolean> = fetch(url, { method: "POST" }).then(
        async (response) => {
          if (!response.ok) {
            throw new Error(
              `Failed to trigger alarm ${element.name}. Status: ${response.status}`
            );
          }
          const alarmResponse = (await response.json()) as AlarmResponse;
          const saved = await saveAlarmState(element, alarmResponse, state);
          return saved;
        }
      );
      triggerPromises.push(promise);
    }
  }
  const res = await Promise.all(triggerPromises);
  return res;
  // const triggerRes = await Promise.all(triggerPromises);
  // const results = saveRes.concat(triggerRes);
  // return results;
}

/**
 * Saves the updated state of an alarm based on the response from the alarm device to redis.
 * Sets cooldown timestamp when alarms are turned off.
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

  // Set cooldown when alarm is turned off
  if (state === "off") {
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
  }

  await alarmRepository.save(alarm as Alarm);
  return true;
}
