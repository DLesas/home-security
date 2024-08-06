import { Repository, Schema } from "redis-om";
import { redis } from ".";

const alarmSchema = new Schema("alarms", {
  name: { type: "string" },
  playing: { type: "boolean" },
  building: { type: "string" },
  ipAddress: { type: "string" },
  onAddress: { type: "string" },
  offAddress: { type: "string" },
  macAddress: { type: "string" },
  created: { type: "date" },
});

export const alarmRepository = new Repository(alarmSchema, redis);

export interface Alarm {
  name: "string";
  playing: "boolean";
  building: "string";
  ipAddress: "string";
  onAddress: "string";
  offAddress: "string";
  macAddress: "string";
  created: "date";
}

await alarmRepository.createIndex();
