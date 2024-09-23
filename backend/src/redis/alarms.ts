import { Repository, Schema } from "redis-om";
import { redis } from ".";

const alarmSchema = new Schema("alarms", {
	name: { type: "string" },
	externalID: { type: "string" },
	playing: { type: "boolean" },
	building: { type: "string" },
	ipAddress: { type: "string" },
	macAddress: { type: "string" },
	lastUpdated: { type: "date" },
});

export const alarmRepository = new Repository(alarmSchema, redis);

export interface Alarm {
	name: string;
	externalID: string;
	playing: boolean;
	building: string;
	ipAddress?: string;
	macAddress?: string;
	lastUpdated: Date;
}

await alarmRepository.createIndex();
