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
	const [newSensor] = await db
		.insert(doorSensorsTable)
		.values({
			name,
			buildingId: buildingExists[0].id,
		})
		.returning();
	await doorSensorRepository.save({
		name: newSensor.name,
		building: newSensor.buildingId,
		status: "disarmed",
	});
	res.status(201).json({ status: "success", data: newSensor });
});

router.post("/handshake", async (req, res) => {
	const validationSchema = z.object({
		sensorId: z.string(),
		macAddress: z.string(),
	});

	const { error, data } = validationSchema.safeParse(req.body);
	if (error) {
		return res.status(400).json({ status: "error", message: error.errors });
	}
	const { sensorId, macAddress } = data;
	const sensor = (await doorSensorRepository
		.search()
		.where("externalID")
		.eq(sensorId)
		.returnFirst()) as doorSensor | null;
	if (!sensor) {
		return res.status(404).json({ status: "error", message: "Sensor not found" });
	}
	if (sensor.ipAddress === undefined) {
		await doorSensorRepository.save({
			...sensor,
			macAddress,
			ipAddress: req.ip,
		});
	}
	res.json({ status: "success", message: "Sensor handshake successful" });
});

router.post("/:sensor/arm", async (req, res) => {
	const { sensor: sensorId } = req.params;
	const sensor = (await doorSensorRepository
		.search()
		.where("externalID")
		.eq(sensorId)
		.returnFirst()) as doorSensor | null;
	if (!sensor) {
		return res.status(404).json({ status: "error", message: "Sensor not found" });
	}
	await changeSensorStatus([sensor], true);
	res.json({ status: "success", message: "Sensor armed" });
});

router.post("/:sensor/disarm", async (req, res) => {
	const { sensor: sensorId } = req.params;
	const sensor = (await doorSensorRepository
		.search()
		.where("externalID")
		.eq(sensorId)
		.returnFirst()) as doorSensor | null;
	if (!sensor) {
		return res.status(404).json({ status: "error", message: "Sensor not found" });
	}
	await changeSensorStatus([sensor], false);
	res.json({ status: "success", message: "Sensor disarmed" });
});

export default router;
