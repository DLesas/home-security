import { type Alarm, alarmRepository } from "./redis/alarms.js";

// Define the expected response type
interface AlarmResponse {
  state: string;
  temperature: number;
  voltage: number;
  frequency: number;
}

/**
 * Changes the state of all alarms supplied via the params to the specified state.
 *
 * @param {Alarm[] | []} alarms - The array of alarms to change the state of.
 * @param {"on" | "off"} state - The state to change the alarms to.
 * @return {Boolean[]} - A promise that resolves to an array of results from the promises of sending the http requests to trigger the alarms.
 */
export async function changeAlarmState(alarms: Alarm[] | [], state: "on" | "off") {
	const triggerPromises = [];
	for (let index = 0; index < alarms.length; index++) {
		const element = alarms[index];
		if (element.ipAddress && element.port) {
			const ipaddr = `http://${element.ipAddress}:${element.port}`;
			const promise: Promise<Boolean> = fetch(state === "on" ? `${ipaddr}/on` : `${ipaddr}/off}`)
			.then(async response => {
				const alarmResponse = await response.json() as AlarmResponse;
				const saved = await saveAlarmState(element, alarmResponse);
				return saved;
				});
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
 *
 * @param {Alarm} alarm - The redis alarm object to be updated.
 * @param {AlarmResponse} res - The response object containing the new state of the alarm relay.
 * @returns {Promise<Boolean>} A promise that resolves to true if the alarm state is successfully saved.
 */
async function saveAlarmState(alarm: Alarm, res: AlarmResponse): Promise<Boolean> {
	res.state == "on" ? alarm.playing = true : alarm.playing = false;
	alarm.temperature = res.temperature;
	alarm.voltage = res.voltage;
	alarm.frequency = res.frequency;
	alarm.lastUpdated = new Date();
	await alarmRepository.save(alarm as Alarm);
	return true;
}
