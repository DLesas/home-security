import { Repository, Schema } from "redis-om";
import { redis } from ".";

const alarmSchema = new Schema("alarms", {
  name: { type: "string" },
  building: { type: "string" },
  ipAddress: { type: "string" },
  onAddress: { type: "string" },
  offAddress: { type: "string" },
  macAddress: { type: "string" },
  created: { type: "date" },
});

export const alarmRepository = new Repository(alarmSchema, redis);

await alarmRepository.createIndex();
