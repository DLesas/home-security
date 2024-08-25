import express from "express";
import { z } from "zod";
import { doorSensorRepository, type doorSensor } from "../../redis/doorSensors";
import { changeSensorStatus } from "../../sensorFuncs";
import { db } from "../../db/db";
import { doorSensorsTable } from "../../db/schema/doorSensors";
import { buildingTable } from "../../db/schema/buildings";
import { eq } from "drizzle-orm";
import { raiseEvent } from "../../notifiy";
import { emitNewData } from "../socketHandler";
import { errorLogsTable } from "../../db/schema/errorLogs";
import { alarmsTable } from "../../db/schema/alarms";
import { type Alarm, alarmRepository } from "../../redis/alarms";
import { EntityId } from "redis-om";

const router = express.Router();

router.post("/new", async (req, res) => {
	const validationSchema = z.object({
		name: z.string(),
		building: z.string(),
	});

	const { error, data } = validationSchema.safeParse(req.body);
	if (error) {
		return res.status(400).json({ status: "error", message: error.errors });
	}
	const { name, building } = data;
	const buildingExists = await db.select().from(buildingTable).where(eq(buildingTable.name, building));
	if (buildingExists.length === 0) {
		return res.status(400).json({ status: "error", message: "Building not found" });
	}
	const [newAlarm] = await db
		.insert(alarmsTable)
		.values({
			name,
			buildingId: buildingExists[0].id,
		})
		.returning();
	await alarmRepository.save({
		name: name,
		externalID: newAlarm.id,
		building: building,
		playing: false,
		created: new Date(),
	} as Alarm);
	await raiseEvent("info", `New alarm ${newAlarm.name} in ${building} with id ${newAlarm.id} added`);
	res.status(201).json({ status: "success", data: newAlarm });
});

router.delete("/:id", async (req, res) => {
	const { id } = req.params;
	const alarm = await alarmRepository.search().where("externalID").eq(id).returnFirst();
	if (!alarm) {
		return res.status(404).json({ status: "error", message: "Alarm not found" });
	}
	const entityId = (alarm as any)[EntityId] as string;
	await alarmRepository.remove(entityId);
	res.json({ status: "success", message: "Alarm deleted" });
});

router.post("/handshake", async (req, res) => {
	const validationSchema = z.object({
		alarmId: z.number(),
		macAddress: z.string(),
	});

	const { error, data } = validationSchema.safeParse(req.body);
	if (error) {
		return res.status(400).json({ status: "error", message: error.errors });
	}
	const { alarmId, macAddress } = data;
	const alarm = (await alarmRepository.search().where("externalID").eq(alarmId).returnFirst()) as Alarm | null;
	if (!alarm) {
		return res.status(404).json({ status: "error", message: "Alarm not found" });
	}
	if (alarm.ipAddress === undefined) {
		await alarmRepository.save({
			...alarm,
			macAddress,
			ipAddress: req.ip,
		} as Alarm);
		await raiseEvent(
			"info",
			`Recieved first handshake from Alarm ${alarm.name} in ${alarm.building} with ip: ${req.ip} , and mac: ${macAddress}`
		);
		await emitNewData();
	}
	res.json({ status: "success", message: "Alarm handshake successful" });
});

export default router;
