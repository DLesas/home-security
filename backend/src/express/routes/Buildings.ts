import express from "express";
import { doorSensorRepository } from "../../redis/doorSensors";
import { changeSensorStatus } from "../../sensorFuncs";
import { db } from "../../db/db";
import { doorSensorsTable } from "../../db/schema/doorSensors";
import { eq } from "drizzle-orm";
import { buildingTable } from "../../db/schema/buildings";
import { raiseError } from "../../errorHandling";
import { raiseEvent } from "../../notifiy";
import { z } from "zod";

const router = express.Router();

router.post("/new", async (req, res) => {
	const validationSchema = z.object({
		name: z.string(),
	});

	const { error, data } = validationSchema.safeParse(req.body);
	if (error) {
		return res.status(400).json({ status: "error", message: error.errors });
	}
	const { name } = data;
	const buildingExists = await db.select().from(buildingTable).where(eq(buildingTable.name, name));
	if (buildingExists.length > 0) {
		return res.status(400).json({ status: "error", message: "Building already exists" });
	}
	const [newBuilding] = await db
		.insert(buildingTable)
		.values({
			name,
		})
		.returning();
	await raiseEvent("info", `New building ${newBuilding.name} added with id ${newBuilding.id}`);
	res.status(201).json({ status: "success", data: newBuilding });
});

router.post("/:building/arm", async (req, res) => {
	const { building } = req.params;
	const buildingId = await db.select().from(buildingTable).where(eq(buildingTable.name, building));
	if (buildingId.length === 0) {
		return res.status(404).json({ status: "error", message: "Building not found" });
	}
	const sensors = await doorSensorRepository.search().where("building").eq(buildingId[0].id).returnAll();
	if (sensors.length === 0) {
		raiseEvent("warning", `no sensors found in building ${building} despite the building being found in db`);
		throw new Error(`no sensors found in building ${building} despite the building being found in db`);
	}
	for (const sensor of sensors) {
		await changeSensorStatus(sensor.id, true);
	}
	res.json({ status: "success", message: `All sensors in building ${building} armed` });
});

router.post("/:building/disarm", async (req, res) => {
	const { building } = req.params;
	const buildingId = await db.select().from(buildingTable).where(eq(buildingTable.name, building));
	if (buildingId.length === 0) {
		return res.status(404).json({ status: "error", message: "Building not found" });
	}
	const sensors = await doorSensorRepository.search().where("building").eq(buildingId[0].id).returnAll();
	if (sensors.length === 0) {
		raiseEvent("warning", `no sensors found in building ${building} despite the building being found in db`);
		throw new Error(`no sensors found in building ${building} despite the building being found in db`);
	}
	for (const sensor of sensors) {
		await changeSensorStatus(sensor.id, false);
	}
	res.json({ status: "success", message: `All sensors in building ${building} disarmed` });
});

export default router;
