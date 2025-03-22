import express from "express";
import { doorSensor, doorSensorRepository } from "../../redis/doorSensors";
import { changeSensorStatus } from "../../sensorFuncs";
import { db, writePostgresCheckpoint } from "../../db/db";
import { eq } from "drizzle-orm";
import { buildingTable } from "../../db/schema/buildings";
import { raiseError } from "src/notifiy";
import { raiseEvent } from "../../notifiy";
import { z } from "zod";
import { makeID } from "../../utils";
import { emitNewData } from "../socketHandler";
import { changeAlarmState } from "../../alarmFuncs";
import { Alarm, alarmRepository } from "../../redis/alarms";
const router = express.Router();

/**
 * @route POST /new
 * @description Creates a new building
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @body {string} name - The name of the building (1-255 characters)
 */
router.post("/new", async (req, res, next) => {
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
    next(raiseError(400, JSON.stringify(result.error.errors)));
    return;
  }
  const { name } = result.data;
  const buildingExists = await db
    .select()
    .from(buildingTable)
    .where(eq(buildingTable.name, name))
    .limit(1);
  if (buildingExists.length > 0) {
    next(raiseError(400, "Building already exists"));
    return;
  }
  const [newBuilding] = await db
    .insert(buildingTable)
    .values({
      id: makeID(),
      name,
    })
    .returning();
  await emitNewData();
  await raiseEvent(
    "info",
    `New building ${newBuilding.name} added with id ${newBuilding.id}`
  );
  await writePostgresCheckpoint();
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
router.post("/:buildingName/arm", async (req, res, next) => {
  const { buildingName } = req.params;
  const buildingId = await db
    .select()
    .from(buildingTable)
    .where(eq(buildingTable.name, buildingName))
    .limit(1);
  if (buildingId.length === 0) {
    next(raiseError(404, "Building not found"));
    return;
  }
  const sensors = (await doorSensorRepository
    .search()
    .where("building")
    .eq(buildingName)
    .returnAll()) as doorSensor[];
  if (sensors.length === 0) {
    next(raiseError(404, "No viable sensors found in building"));
    return;
  }
  await changeSensorStatus(sensors, true);
  await emitNewData();
  await raiseEvent("warning", `All sensors in building ${buildingName} armed`);
  res.status(200).json({
    status: "success",
    message: `All sensors in building ${buildingName} armed`,
  });
});

/**
 * @route POST /:buildingName/disarm
 * @description Disarms all sensors in a building
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @urlparam {string} buildingName - The name of the building
 */
router.post("/:buildingName/disarm", async (req, res, next) => {
  const { buildingName } = req.params;
  const buildingId = await db
    .select()
    .from(buildingTable)
    .where(eq(buildingTable.name, buildingName))
    .limit(1);
  if (buildingId.length === 0) {
    next(raiseError(404, "Building not found"));
    return;
  }
  const allSensors = (await doorSensorRepository
    .search()
    .returnAll()) as doorSensor[];
  const sensors = allSensors.filter(
    (sensor) => sensor.building === buildingName
  );
  if (sensors.length === 0) {
    next(raiseError(404, "No viable sensors found in building"));
    return;
  }
  const alarms = (await alarmRepository.search().returnAll()) as Alarm[];
  const alarmOn = alarms.some((alarm) => alarm.playing);
  if (alarmOn) {
    await changeAlarmState(alarms, "off");
    await changeSensorStatus(allSensors, false);
  } else {
    await changeSensorStatus(sensors, false);
  }
  await emitNewData();
  await raiseEvent(
    "warning",
    `All sensors in building ${buildingName} disarmed`
  );
  res.status(200).json({
    status: "success",
    message: `All sensors in building ${buildingName} disarmed`,
  });
});

export default router;
