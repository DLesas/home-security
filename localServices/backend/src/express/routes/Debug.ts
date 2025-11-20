import express from "express";
import { z } from "zod";
import { doorSensorRepository, type doorSensor } from "../../redis/doorSensors";
import { type Alarm, alarmRepository } from "../../redis/alarms";
import { db, writePostgresCheckpoint } from "../../db/db";
import { sensorsTable } from "../../db/schema/sensors";
import { alarmsTable } from "../../db/schema/alarms";
import { buildingTable } from "../../db/schema/buildings";
import { eq } from "drizzle-orm";
import { raiseEvent } from "../../events/notify";
import { emitNewData } from "../socketHandler";
import { raiseError } from "../../events/notify";
import { writeRedisCheckpoint } from "../../redis/index";
import { sensorTimeoutMonitor } from "../../microDeviceTimeoutMonitor";

const router = express.Router();

/**
 * @route POST /sensors/new
 * @description DEBUG ONLY - Creates a new sensor with a custom ID
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @body {string} id - The custom ID for the sensor (1-255 characters)
 * @body {string} name - The name of the sensor (1-255 characters)
 * @body {string} building - The name of the building (1-255 characters)
 * @body {number} expectedSecondsUpdated - Expected update interval (0-86400 seconds)
 */
router.post("/sensors/new", async (req, res, next) => {
  const validationSchema = z.object({
    id: z
      .string({
        required_error: "id is required",
        invalid_type_error: "id must be a string",
      })
      .min(1, "id must be at least 1 character")
      .max(255, "id must be less than 255 characters"),
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
    expectedSecondsUpdated: z
      .number({
        required_error: "expectedSecondsUpdated is required",
        invalid_type_error: "expectedSecondsUpdated must be a number",
      })
      .min(0, "expectedSecondsUpdated must be more than 0 seconds")
      .max(3600 * 24, "expectedSecondsUpdated must be less than 24 hours"),
  });

  const result = validationSchema.safeParse(req.body);
  if (!result.success) {
    next(raiseError(400, JSON.stringify(result.error.errors)));
    return;
  }
  const { id, name, building, expectedSecondsUpdated } = result.data;

  // Check if ID already exists in PostgreSQL
  const existingInPostgres = await db
    .select()
    .from(sensorsTable)
    .where(eq(sensorsTable.id, id))
    .limit(1);

  if (existingInPostgres.length > 0) {
    next(raiseError(409, `Sensor with ID ${id} already exists in PostgreSQL`));
    return;
  }

  // Check if ID already exists in Redis
  const existingInRedis = (await doorSensorRepository
    .search()
    .where("externalID")
    .eq(id)
    .returnFirst()) as doorSensor | null;

  if (existingInRedis) {
    next(raiseError(409, `Sensor with ID ${id} already exists in Redis`));
    return;
  }

  // Validate building exists
  const buildingExists = await db
    .select()
    .from(buildingTable)
    .where(eq(buildingTable.name, building))
    .limit(1);

  if (buildingExists.length === 0) {
    next(raiseError(404, "Building not found"));
    return;
  }

  // Create sensor in PostgreSQL with custom ID
  const [newSensor] = await db
    .insert(sensorsTable)
    .values({
      id: id, // Use custom ID instead of makeID()
      name,
      buildingId: buildingExists[0].id,
    })
    .returning();

  // Create sensor in Redis
  await doorSensorRepository.save(newSensor.id, {
    name: newSensor.name,
    externalID: newSensor.id,
    building: building,
    armed: false,
    state: "unknown",
    temperature: 0,
    expectedSecondsUpdated,
    lastUpdated: new Date(),
  } as doorSensor);

  await raiseEvent({
    type: "info",
    message: `DEBUG: New sensor ${newSensor.name} in ${building} with custom id ${newSensor.id} added`,
    system: "backend:debug",
    title: `DEBUG - Sensor Added: ${newSensor.name} in ${building}`,
  });

  await writePostgresCheckpoint();
  await writeRedisCheckpoint();
  await emitNewData();

  // Recreate monitoring intervals if monitor is running
  if (sensorTimeoutMonitor.isRunning()) {
    await sensorTimeoutMonitor.recreateAllIntervals();
  }

  res.status(201).json({
    status: "success",
    data: {
      id: newSensor.id,
      name: newSensor.name,
      expectedSecondsUpdated,
    },
  });
});

/**
 * @route POST /alarms/new
 * @description DEBUG ONLY - Creates a new alarm with a custom ID
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @body {string} id - The custom ID for the alarm (1-255 characters)
 * @body {string} name - The name of the alarm (1-255 characters)
 * @body {string} building - The name of the building (1-255 characters)
 * @body {number} expectedSecondsUpdated - Expected update interval (0-86400 seconds)
 * @body {number} port - Port number for the alarm (1-65535)
 * @body {number} autoTurnOffSeconds - Auto turn-off timeout in seconds (0 = no timeout, max 86400)
 */
router.post("/alarms/new", async (req, res, next) => {
  const validationSchema = z.object({
    id: z
      .string({
        required_error: "id is required",
        invalid_type_error: "id must be a string",
      })
      .min(1, "id must be at least 1 character")
      .max(255, "id must be less than 255 characters"),
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
    expectedSecondsUpdated: z
      .number({
        required_error: "expectedSecondsUpdated is required",
        invalid_type_error: "expectedSecondsUpdated must be a number",
      })
      .min(0, "expectedSecondsUpdated must be more than 0 seconds")
      .max(3600 * 24, "expectedSecondsUpdated must be less than 24 hours"),
    port: z
      .number({
        required_error: "port is required",
        invalid_type_error: "port must be a number",
      })
      .min(1, "port must be more than 0")
      .max(65535, "port must be less than 65535"),
    autoTurnOffSeconds: z
      .number({
        required_error: "autoTurnOffSeconds is required",
        invalid_type_error: "autoTurnOffSeconds must be a number",
      })
      .min(0, "autoTurnOffSeconds must be 0 or greater (0 = no timeout)")
      .max(
        86400,
        "autoTurnOffSeconds must be less than 24 hours (86400 seconds)"
      ),
  });

  const result = validationSchema.safeParse(req.body);
  if (!result.success) {
    next(raiseError(400, JSON.stringify(result.error.errors)));
    return;
  }
  const { id, name, building, expectedSecondsUpdated, port, autoTurnOffSeconds } =
    result.data;

  // Check if ID already exists in PostgreSQL
  const existingInPostgres = await db
    .select()
    .from(alarmsTable)
    .where(eq(alarmsTable.id, id))
    .limit(1);

  if (existingInPostgres.length > 0) {
    next(raiseError(409, `Alarm with ID ${id} already exists in PostgreSQL`));
    return;
  }

  // Check if ID already exists in Redis
  const existingInRedis = (await alarmRepository
    .search()
    .where("externalID")
    .eq(id)
    .returnFirst()) as Alarm | null;

  if (existingInRedis) {
    next(raiseError(409, `Alarm with ID ${id} already exists in Redis`));
    return;
  }

  // Validate building exists
  const buildingExists = await db
    .select()
    .from(buildingTable)
    .where(eq(buildingTable.name, building))
    .limit(1);

  if (buildingExists.length === 0) {
    next(raiseError(404, "Building not found"));
    return;
  }

  // Create alarm in PostgreSQL with custom ID
  const [newAlarm] = await db
    .insert(alarmsTable)
    .values({
      id: id, // Use custom ID instead of makeID()
      name,
      buildingId: buildingExists[0].id,
      port,
    })
    .returning();

  // Create alarm in Redis
  await alarmRepository.save(newAlarm.id, {
    name: name,
    externalID: newAlarm.id,
    building: building,
    playing: false,
    state: "connected",
    expectedSecondsUpdated: expectedSecondsUpdated,
    port: port,
    autoTurnOffSeconds: autoTurnOffSeconds,
    lastUpdated: new Date(),
  } as Alarm);

  await raiseEvent({
    type: "info",
    message: `DEBUG: New alarm ${newAlarm.name} in ${building} with custom id ${newAlarm.id} added`,
    system: "backend:debug",
    title: `DEBUG - Alarm Added: ${newAlarm.name} in ${building}`,
  });

  await writePostgresCheckpoint();
  await writeRedisCheckpoint();
  await emitNewData();

  // Recreate monitoring intervals if monitor is running
  if (sensorTimeoutMonitor.isRunning()) {
    await sensorTimeoutMonitor.recreateAllIntervals();
  }

  res.status(201).json({
    status: "success",
    data: {
      id: newAlarm.id,
      name: newAlarm.name,
      expectedSecondsUpdated,
      autoTurnOffSeconds,
    },
  });
});

export default router;
