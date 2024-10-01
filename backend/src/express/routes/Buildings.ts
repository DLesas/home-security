import express from "express";
import { doorSensor, doorSensorRepository } from "../../redis/doorSensors.js";
import { changeSensorStatus } from "../../sensorFuncs.js";
import { db } from "../../db/db.js";
import { doorSensorsTable } from "../../db/schema/doorSensors.js";
import { eq } from "drizzle-orm";
import { buildingTable } from "../../db/schema/buildings.js";
import { raiseError } from "../../errorHandling.js";
import { raiseEvent } from "../../notifiy.js";
import { z } from "zod";
import { makeID } from "../../utils.js";
import { emitNewData } from "../socketHandler.js";

const router = express.Router();

/**
 * @route POST /new
 * @description Creates a new building
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @body {string} name - The name of the building (1-255 characters)
 */
router.post("/new", async (req, res) => {
	const validationSchema = z.object({
		name: z
			.string({
				required_error: "name is required",
				invalid_type_error: "name must be a string",
			})
			.min(1, "name must be at least 1 character")
			.max(255, "name must be less than 255 characters"),
	});

	const result = validationSchema.safeParse(req.body);
	if (!result.success) {
		raiseError(400, JSON.stringify(result.error.errors));
		return;
	}
	const { name } = result.data;
	const buildingExists = await db.select().from(buildingTable).where(eq(buildingTable.name, name)).limit(1);
	if (buildingExists.length > 0) {
		raiseError(400, "Building already exists");
		return;
	}
	const [newBuilding] = await db
		.insert(buildingTable)
		.values({
			id: makeID(),
			name,
		})
		.returning();
	await raiseEvent("info", `New building ${newBuilding.name} added with id ${newBuilding.id}`);
	await emitNewData();
	res.status(201).json({ status: "success", data: newBuilding });
});

/**
 * @route POST /:buildingName/arm
 * @description Arms all sensors in a building
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @urlparam {string} buildingName - The name of the building
 */
router.post("/:buildingName/arm", async (req, res) => {
	const { buildingName } = req.params;
	const buildingId = await db.select().from(buildingTable).where(eq(buildingTable.name, buildingName)).limit(1);
	if (buildingId.length === 0) {
		raiseError(404, "Building not found");
		return;
	}
	const sensors = (await doorSensorRepository
		.search()
		.where("building")
		.eq(buildingId[0].id)
		.returnAll()) as doorSensor[];
	if (sensors.length === 0) {
		raiseError(404, "No viable sensors found in building");
		return;
	}
	await changeSensorStatus(sensors, true);
	await emitNewData();
	res.json({ status: "success", message: `All sensors in building ${buildingName} armed` });
});

/**
 * @route POST /:buildingName/disarm
 * @description Disarms all sensors in a building
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @urlparam {string} buildingName - The name of the building
 */
router.post("/:buildingName/disarm", async (req, res) => {
	const { buildingName } = req.params;
	const buildingId = await db.select().from(buildingTable).where(eq(buildingTable.name, buildingName)).limit(1);
	if (buildingId.length === 0) {
		raiseError(404, "Building not found");
		return;
	}
	const sensors = (await doorSensorRepository
		.search()
		.where("building")
		.eq(buildingId[0].id)
		.returnAll()) as doorSensor[];
	if (sensors.length === 0) {
		raiseError(404, "No viable sensors found in building");
		return;
	}
	await changeSensorStatus(sensors, false);
	await emitNewData();
	res.json({ status: "success", message: `All sensors in building ${buildingName} disarmed` });
});

export default router;
