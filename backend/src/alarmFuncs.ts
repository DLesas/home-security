import { type Alarm, alarmRepository } from "./redis/alarms";

/**
 * Changes the state of all alarms supplied via the params to the specified state.
 *
 * @param {Alarm[] | []} alarms - The array of alarms to change the state of.
 * @param {"on" | "off"} state - The state to change the alarms to.
 * @return {Promise<any[]>} - A promise that resolves to an array of results from the promises of sending the http requests to trigger the alarms.
 */
export async function changeAlarmState(alarms: Alarm[] | [], state: "on" | "off") {
	const triggerPromises = [];
	const savePromises = [];
	for (let index = 0; index < alarms.length; index++) {
		const element = alarms[index];
		element.playing = state === "on" ? true : false;
		savePromises.push(alarmRepository.save(element));
		triggerPromises.push(fetch(state === "on" ? `${element.ipAddress}/on` : `${element.ipAddress}/off`));
	}
	const saveRes = await Promise.all(savePromises);
	const triggerRes = await Promise.all(triggerPromises);
	const results = saveRes.concat(triggerRes);
	return results;
}
