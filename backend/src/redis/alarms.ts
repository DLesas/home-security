import { Repository, Schema } from "redis-om";
import { redis } from "./index.js";

const alarmSchema = new Schema("alarms", {
	name: { type: "string" },
	externalID: { type: "string" },
	playing: { type: "boolean" },
	building: { type: "string" },
	ipAddress: { type: "string" },
	port: { type: "number" },
	macAddress: { type: "string" },
	temperature: { type: "number" },
	voltage: { type: "number" },
	frequency: { type: "number" },
	expectedSecondsUpdated: { type: "number" },
	lastUpdated: { type: "date" },
});

export const alarmRepository = new Repository(alarmSchema, redis);

export interface Alarm {
	name: string;
	externalID: string;
	playing: boolean;
	building: string;
	ipAddress?: string;
	port: number;
	macAddress?: string;
	temperature?: number;
	voltage?: number;
	frequency?: number;
	expectedSecondsUpdated: number;
	lastUpdated: Date;
}

export const createAlarmIndex = async () => {
	try {
		await alarmRepository.createIndex();
	} catch (error) {
		console.error('Error creating alarm index:', error);
	}
};
