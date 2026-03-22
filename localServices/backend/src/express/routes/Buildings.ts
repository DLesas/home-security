import express from "express";
import { doorSensor, doorSensorRepository } from "../../redis/doorSensors";
import { changeSensorStatus } from "../../sensorFuncs";
import { db, writePostgresCheckpoint } from "../../db/db";
import { eq } from "drizzle-orm";
import { buildingTable } from "../../db/schema/buildings";
import { raiseError } from "../../events/notify";
import { raiseEvent } from "../../events/notify";
import { z } from "zod";
import { makeID } from "../../utils/index";
import { emitNewData } from "../socketHandler";
import { changeAlarmState } from "../../alarmFuncs";
import { Alarm, alarmRepository } from "../../redis/alarms";
import { cameraRepository, Camera } from "../../redis/cameras";
import { redis, writeRedisCheckpoint } from "../../redis/index";
import { sensorTimeoutMonitor } from "../../microDeviceTimeoutMonitor";
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
      .string()
      .min(1, "name must be at least 1 character")
      .max(255, "name must be less than 255 characters"),
  });

  const result = validationSchema.safeParse(req.body);
  if (!result.success) {
    next(raiseError(400, JSON.stringify(result.error.issues)));
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
  await raiseEvent({
    type: "info",
    message: `New building ${newBuilding.name} added with id ${newBuilding.id}`,
    system: "backend:buildings",
    title: `Building Added: ${newBuilding.name}`,
  });
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
  await raiseEvent({
    type: "warning",
    message: `All sensors in building ${buildingName} armed`,
    system: "backend:buildings",
    title: `Building Armed: ${buildingName}`,
  });
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
  await raiseEvent({
    type: "warning",
    message: `All sensors in building ${buildingName} disarmed`,
    system: "backend:buildings",
    title: `Building Disarmed: ${buildingName}`,
  });
  res.status(200).json({
    status: "success",
    message: `All sensors in building ${buildingName} disarmed`,
  });
});

router.get("/", async (req, res, next) => {
  try {
    const buildings = await db
      .select()
      .from(buildingTable);
    res.status(200).json({ status: "success", data: buildings });
  } catch (err) {
    next(err);
  }
});

/**
 * @route DELETE /:buildingId
 * @description Hard deletes a building by ID (cascades to sensors, alarms, cameras in PostgreSQL)
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @urlparam {string} buildingId - The ID of the building to delete
 */
router.delete("/:buildingId", async (req, res, next) => {
  const { buildingId } = req.params;

  try {
    // Check if building exists
    const [building] = await db
      .select()
      .from(buildingTable)
      .where(eq(buildingTable.id, buildingId))
      .limit(1);

    if (!building) {
      next(raiseError(404, "Building not found"));
      return;
    }

    // Find all entities in Redis to clean up after PostgreSQL cascade
    const sensors = (await doorSensorRepository
      .search()
      .where("building")
      .eq(building.name)
      .returnAll()) as doorSensor[];

    const alarms = (await alarmRepository
      .search()
      .where("building")
      .eq(building.name)
      .returnAll()) as Alarm[];

    const cameras = (await cameraRepository
      .search()
      .where("building")
      .eq(building.name)
      .return.all()) as Camera[];

    // Hard delete building - PostgreSQL cascade handles sensors/alarms/cameras
    await db
      .delete(buildingTable)
      .where(eq(buildingTable.id, buildingId));

    // Clean up Redis entries (not handled by PostgreSQL cascade)
    for (const sensor of sensors) {
      await redis.del(`doorSensors:${sensor.externalID}`);
    }
    for (const alarm of alarms) {
      await redis.del(`alarms:${alarm.externalID}`);
    }
    for (const camera of cameras) {
      await redis.del(`cameras:${camera.externalID}`);
    }

    // Recreate timeout intervals (sensors/alarms removed)
    await sensorTimeoutMonitor.recreateAllIntervals();

    await raiseEvent({
      type: "warning",
      message: `Building "${building.name}" deleted with ${sensors.length} sensors, ${alarms.length} alarms, and ${cameras.length} cameras`,
      system: "backend:buildings",
      title: `Building Deleted: ${building.name}`,
    });

    await emitNewData();
    await writePostgresCheckpoint();
    await writeRedisCheckpoint();

    res.status(200).json({
      status: "success",
      message: `Building "${building.name}" deleted successfully`,
    });
  } catch (err) {
    console.error("Error deleting building:", err);
    next(raiseError(500, "Failed to delete building"));
  }
});

export default router;
