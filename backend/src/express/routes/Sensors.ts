import express from "express";
import { z } from "zod";
import { doorSensorRepository, type doorSensor } from "../../redis/doorSensors";
import { changeSensorStatus, DoorSensorUpdate } from "../../sensorFuncs";
import { db } from "../../db/db";
import { doorSensorsTable } from "../../db/schema/doorSensors";
import { buildingTable } from "../../db/schema/buildings";
import { eq } from "drizzle-orm";
import { raiseEvent } from "../../notifiy";
import { emitNewData } from "../socketHandler";
import { errorLogsTable } from "../../db/schema/errorLogs";
import { EntityId } from "redis-om";
import { raiseError } from "../../errorHandling";

const router = express.Router();

router.post("/new", async (req, res) => {
	const validationSchema = z.object({
		name: z
			.string({
				required_error: "name is required",
				invalid_type_error: "name must be a string",
			})
			.min(1, "name must be at least 1 character")
			.max(255, "name must be less than 255 characters"),
		building: z
			.string({
				required_error: "building is required",
				invalid_type_error: "building must be a string",
			})
			.min(1, "building must be at least 1 character")
			.max(255, "building must be less than 255 characters"),
	});

	const result = validationSchema.safeParse(req.body);
	if (!result.success) {
		raiseError(400, JSON.stringify(result.error.errors));
		return;
	}
	const { name, building } = result.data;
	const buildingExists = await db.select().from(buildingTable).where(eq(buildingTable.name, building)).limit(1);
	if (buildingExists.length === 0) {
		raiseError(404, "Building not found");
		return;
	}
	const [newSensor] = await db
		.insert(doorSensorsTable)
		.values({
			name,
			buildingId: buildingExists[0].id,
		})
		.returning();
	const { buildingId, ...newSensorData } = newSensor;
	await doorSensorRepository.save({
		name: newSensor.name,
		externalID: newSensor.id,
		building: building,
		armed: false,
		state: "unknown",
		temperature: 0,
		date: new Date(),
	} as doorSensor);
	await raiseEvent("info", `New sensor ${newSensor.name} in ${building} with id ${newSensor.id} added`);
	await emitNewData();
	res.status(201).json({ status: "success", data: newSensorData });
});

router.delete("/:id", async (req, res) => {
	const { id } = req.params;
	const sensor = (await doorSensorRepository.search().where("externalID").eq(id).returnFirst()) as doorSensor | null;
	if (!sensor) {
		raiseError(404, "Sensor not found");
		return;
	}
	const entityId = (sensor as any)[EntityId] as string;
	await doorSensorRepository.remove(entityId);
	await raiseEvent("info", `Sensor ${sensor.name} in ${sensor.building} deleted`);
	await emitNewData();
	res.json({ status: "success", message: `Sensor ${sensor.name} in ${sensor.building} deleted` });
});

router.post("/:sensor/handshake", async (req, res) => {
	const { sensor: sensorId } = req.params;
	const validationSchema = z.object({
		macAddress: z
			.string()
			.min(1, "macAddress must be at least 1 character")
			.max(255, "macAddress must be less than 255 characters"),
	});
	const { error, data } = validationSchema.safeParse(req.body);
	if (error) {
		raiseError(400, JSON.stringify(error.errors));
		return;
	}
	const { macAddress } = data;
	const sensor = (await doorSensorRepository
		.search()
		.where("externalID")
		.eq(sensorId)
		.returnFirst()) as doorSensor | null;
	if (!sensor) {
		raiseError(404, "Sensor not found");
		return;
	}
	if (!sensor.ipAddress) {
		await doorSensorRepository.save({
			...sensor,
			macAddress,
			ipAddress: req.ip,
		} as doorSensor);
		await raiseEvent(
			"info",
			`Recieved first handshake from sensor ${sensor!.name} in ${sensor!.building} with ip: ${
				req.ip
			} , and mac: ${macAddress}`
		);
		await emitNewData();
	}
	res.json({ status: "success", message: "Sensor handshake successful" });
});

router.post("/:sensor/update", async (req, res) => {
	const { sensor: sensorId } = req.params;
	const validationSchema = z.object({
		status: z.enum(["open", "closed"], {
			required_error: "status is required",
			invalid_type_error: "status must be one of: open, closed",
		}),
		temperature: z
			.number({
				required_error: "temperature is required",
				invalid_type_error: "temperature must be a number",
			})
			.min(-100, "implausible temperature")
			.max(120, "implausible temperature"),
	});
	const result = validationSchema.safeParse(req.body);
	if (!result.success) {
		raiseError(400, JSON.stringify(result.error.errors));
		return;
	}
	const { status, temperature } = result.data;
	await DoorSensorUpdate({ sensorId, state: status, temperature });
	await emitNewData();
	res.json({ status: "success", message: "Log updated" });
});

router.post("/:sensor/arm", async (req, res) => {
	const { sensor: sensorId } = req.params;
	const sensor = (await doorSensorRepository
		.search()
		.where("externalID")
		.eq(sensorId)
		.returnFirst()) as doorSensor | null;
	if (!sensor) {
		raiseError(404, "Sensor not found");
		return;
	}
	await changeSensorStatus([sensor], true);
	await emitNewData();
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
		raiseError(404, "Sensor not found");
		return;
	}
	await changeSensorStatus([sensor], false);
	await emitNewData();
	res.json({ status: "success", message: "Sensor disarmed" });
});

export default router;
