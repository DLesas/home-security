import express from "express";
import { z } from "zod";
import { doorSensorRepository, type doorSensor } from "../../redis/doorSensors";
import { changeSensorStatus, DoorSensorUpdate } from "../../sensorFuncs";
import { db, writePostgresCheckpoint } from "../../db/db";
import { sensorsTable } from "../../db/schema/sensors";
import { buildingTable } from "../../db/schema/buildings";
import { eq } from "drizzle-orm";
import { raiseEvent } from "../../events/notify";
import { emitNewData } from "../socketHandler";
import { EntityId } from "redis-om";
import { raiseError } from "../../events/notify";
import { makeID } from "../../utils/index";
import { sensorLogsTable } from "../../db/schema/sensorLogs";
import { writeRedisCheckpoint } from "../../redis/index";
import { identifyDevice } from "../../utils/deviceIdentification";
import { sensorTimeoutMonitor } from "../../microDeviceTimeoutMonitor";

const router = express.Router();

// Routes below are used by the sensors themselves

/**
 * @route POST /:sensorId/handshake
 * @description Handles the handshake for a sensor
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @urlparam {string} sensorId - The ID of the sensor
 * @body {string} macAddress - The MAC address of the sensor (1-255 characters)
 */
router.post("/:sensorId/handshake", async (req, res, next) => {
  const { sensorId } = req.params;
  const validationSchema = z.object({
    macAddress: z
      .string()
      .min(1, "macAddress must be at least 1 character")
      .max(255, "macAddress must be less than 255 characters"),
  });
  const { error, data } = validationSchema.safeParse(req.body);
  if (error) {
    next(raiseError(400, JSON.stringify(error.errors)));
    return;
  }
  const { macAddress } = data;

  // Try to identify device using headers first, then fallback to URL param
  const deviceInfo = await identifyDevice(req);
  const targetSensorId = deviceInfo?.id || sensorId;
  const deviceIp = deviceInfo?.ipAddress;

  const sensor = (await doorSensorRepository
    .search()
    .where("externalID")
    .eq(targetSensorId)
    .returnFirst()) as doorSensor | null;

  if (!sensor) {
    console.log(`Sensor not found with ID: ${targetSensorId}`);
    console.log(
      "Available sensors:",
      await doorSensorRepository.search().returnAll()
    );
    next(raiseError(404, "Sensor not recognized"));
    return;
  }

  // Update sensor info if IP or MAC has changed
  if (
    !sensor.ipAddress ||
    sensor.ipAddress !== deviceIp ||
    !sensor.macAddress ||
    sensor.macAddress !== macAddress
  ) {
    await doorSensorRepository.save(sensor.externalID, {
      ...sensor,
      macAddress,
      ipAddress: deviceIp,
      lastUpdated: new Date(),
    } as doorSensor);
    await emitNewData();

    const identificationMethod =
      deviceInfo?.identificationMethod || "url_param";
    await raiseEvent({
      type: "info",
      message: `Received handshake from sensor ${sensor.name} in ${sensor.building} (identified by: ${identificationMethod}) with ip: ${deviceIp}, mac: ${macAddress}`,
      system: "backend:sensors",
    });
  }

  res
    .status(200)
    .json({ status: "success", message: "Sensor handshake successful" });
});

/**
 * @route POST /update
 * @description Updates the status and temperature of a sensor
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @body {string} status - The status of the sensor (open, closed)
 * @body {number} temperature - The temperature reading of the sensor (-100 to 120)
 */
router.post("/update", async (req, res, next) => {
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
    voltage: z
      .number({
        required_error: "voltage is required",
        invalid_type_error: "voltage must be a number",
      })
      .optional()
      .nullable(),
    frequency: z
      .number({
        invalid_type_error: "frequency must be a number",
      })
      .optional()
      .nullable(),
  });
  const result = validationSchema.safeParse(req.body);
  if (!result.success) {
    next(raiseError(400, JSON.stringify(result.error.errors)));
    return;
  }

  // Try to identify device using headers first, then fallback to IP
  const deviceInfo = await identifyDevice(req);
  if (!deviceInfo || deviceInfo.type !== "sensor") {
    next(
      raiseError(
        404,
        "Sensor not recognized - ensure device headers are set correctly"
      )
    );
    return;
  }

  const sensor = (await doorSensorRepository
    .search()
    .where("externalID")
    .eq(deviceInfo.id)
    .returnFirst()) as doorSensor | null;

  if (!sensor) {
    next(raiseError(404, "Sensor not found in database"));
    return;
  }

  const { status, temperature, voltage, frequency } = result.data;
  try {
    await DoorSensorUpdate({
      sensorId: sensor.externalID,
      state: status,
      temperature,
      voltage,
      frequency,
    });
  } catch (err) {
    next(err);
    return;
  }

  await emitNewData();
  await raiseEvent({
    type: "info",
    message: `Sensor ${sensor.name} in ${sensor.building} (identified by: ${deviceInfo.identificationMethod}) updated with state: ${status}, temperature: ${temperature}, voltage: ${voltage}, frequency: ${frequency}`,
    system: "backend:sensors",
  });
  res.status(200).json({
    status: "success",
    armed: sensor.armed,
    message: "update acknowledged",
  });
});

/**
 * @route POST /logs
 * @description Logs error messages from a sensor
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @body {Array} logs - An array of log objects
 * @body {string} logs[].Timestamp - The timestamp of the log (valid date string)
 * @body {string} logs[].Type - The type of the log
 * @body {string} logs[].Class - The class of the log
 * @body {string} logs[].Function - The function where the log occurred
 * @body {string} logs[].Error_Message - The error message
 * @body {string} logs[].Hash - The MD5 hash of the log
 * @body {number} logs[].Count - The count of occurrences
 */
router.post("/logs", async (req, res, next) => {
  const logSchema = z.object({
    Timestamp: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Timestamp must be a valid date string",
    }),
    Type: z.string().min(1, "Type is required"),
    Class: z.string().min(1, "Class is required"),
    Function: z.string().min(1, "Function is required"),
    Error_Message: z.string().min(1, "Error_Message is required"),
    Hash: z
      .string()
      .regex(/^[a-f0-9]{64}$/, "Hash must be a valid SHA-256 hash"),
    Count: z.number().int().min(1, "Count must be a positive integer"),
    last_seen: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "last_seen must be a valid date string",
    }),
  });
  const validationSchema = z.array(logSchema);

  const result = validationSchema.safeParse(req.body);
  if (!result.success) {
    next(raiseError(400, JSON.stringify(result.error.errors)));
    return;
  }

  // Try to identify device using headers first, then fallback to IP
  const deviceInfo = await identifyDevice(req);
  if (!deviceInfo || deviceInfo.type !== "sensor") {
    next(
      raiseError(
        404,
        "Sensor not recognized - ensure device headers are set correctly"
      )
    );
    return;
  }

  const sensor = (await doorSensorRepository
    .search()
    .where("externalID")
    .eq(deviceInfo.id)
    .returnFirst()) as doorSensor | null;

  if (!sensor) {
    next(raiseError(404, "Sensor not found in database"));
    return;
  }

  await db.insert(sensorLogsTable).values(
    result.data.map((item) => ({
      sensorId: sensor.externalID,
      function: item.Function,
      dateTime: new Date(item.Timestamp),
      hash: item.Hash,
      class: item.Class,
      type: item.Type,
      errorMessage: item.Error_Message,
      count: item.Count,
      last_seen: new Date(item.last_seen),
    }))
  );

  await raiseEvent({
    type: "info",
    message: `Logs received from sensor ${sensor.name} in ${sensor.building} (identified by: ${deviceInfo.identificationMethod})`,
    system: "backend:sensors",
  });
  res.status(200).json({ status: "success", message: "Logs received" });
});

// Routes below are used by the admin interface

/**
 * @route POST /new
 * @description Creates a new sensor
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @body {string} name - The name of the sensor (1-255 characters)
 * @body {string} building - The name of the building (1-255 characters)
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
  const { name, building, expectedSecondsUpdated } = result.data;
  const buildingExists = await db
    .select()
    .from(buildingTable)
    .where(eq(buildingTable.name, building))
    .limit(1);
  console.log(await db.select().from(buildingTable));
  console.log(buildingExists);
  if (buildingExists.length === 0) {
    next(raiseError(404, "Building not found"));
    return;
  }
  const [newSensor] = await db
    .insert(sensorsTable)
    .values({
      id: makeID(),
      name,
      buildingId: buildingExists[0].id,
    })
    .returning();
  const { buildingId, ...newSensorData } = newSensor;
  const data = {
    id: newSensor.id,
    name: newSensor.name,
    expectedSecondsUpdated,
  };
  // Save with explicit ID to avoid duplicate entities
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
    message: `New sensor ${newSensor.name} in ${building} with id ${newSensor.id} added`,
    system: "backend:sensors",
    title: `Sensor Added: ${newSensor.name} in ${building}`,
  });
  await writePostgresCheckpoint();
  await writeRedisCheckpoint();
  await emitNewData();
  // It should always be running when these routes exist, but just to be safe
  if (sensorTimeoutMonitor.isRunning()) {
    await sensorTimeoutMonitor.recreateAllIntervals();
  }

  res.status(201).json({ status: "success", data: data });
});

/**
 * @route DELETE /:sensorId
 * @description Deletes a sensor by ID
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @urlparam {string} sensorId - The ID of the sensor to delete
 */
router.delete("/:sensorId", async (req, res, next) => {
  const { sensorId } = req.params;
  const sensor = (await doorSensorRepository
    .search()
    .where("externalID")
    .eq(sensorId)
    .returnFirst()) as doorSensor | null;
  if (!sensor) {
    next(raiseError(404, "Sensor not recognized"));
    return;
  }
  const entityId = (sensor as any)[EntityId] as string;
  await db
    .update(sensorsTable)
    .set({ deleted: true })
    .where(eq(sensorsTable.id, sensorId));
  await doorSensorRepository.remove(entityId);
  await raiseEvent({
    type: "warning",
    message: `Sensor ${sensor.name} in ${sensor.building} deleted`,
    system: "backend:sensors",
    title: `Sensor Deleted: ${sensor.name} in ${sensor.building}`,
  });
  await emitNewData();
  await writePostgresCheckpoint();
  await writeRedisCheckpoint();
  // It should always be running when these routes exist, but just to be safe
  if (sensorTimeoutMonitor.isRunning()) {
    await sensorTimeoutMonitor.recreateAllIntervals();
  }

  res.status(200).json({
    status: "success",
    message: `Sensor ${sensor.name} in ${sensor.building} deleted`,
  });
});

// Routes below are used by the phone app and the web app

/**
 * @route POST /:sensorId/arm
 * @description Arms a sensor by ID
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @urlparam {string} sensorId - The ID of the sensor to arm
 */
router.post("/:sensorId/arm", async (req, res, next) => {
  const { sensorId } = req.params;
  const sensor = (await doorSensorRepository
    .search()
    .where("externalID")
    .eq(sensorId)
    .returnFirst()) as doorSensor | null;
  if (!sensor) {
    next(raiseError(404, "Sensor not recognized"));
    return;
  }
  await changeSensorStatus([sensor], true);
  await emitNewData();
  await raiseEvent({
    type: "warning",
    message: `Sensor ${sensor.name} in ${sensor.building} armed`,
    system: "backend:sensors",
    title: `Sensor Armed: ${sensor.name} in ${sensor.building}`,
  });
  res.json({ status: "success", message: "Sensor armed" });
});

/**
 * @route POST /:sensorId/disarm
 * @description Disarms a sensor by ID
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @urlparam {string} sensorId - The ID of the sensor to disarm
 */
router.post("/:sensorId/disarm", async (req, res, next) => {
  const { sensorId } = req.params;
  const sensor = (await doorSensorRepository
    .search()
    .where("externalID")
    .eq(sensorId)
    .returnFirst()) as doorSensor | null;
  if (!sensor) {
    next(raiseError(404, "Sensor not recognized"));
    return;
  }
  await changeSensorStatus([sensor], false);
  await emitNewData();
  await raiseEvent({
    type: "warning",
    message: `Sensor ${sensor.name} in ${sensor.building} disarmed`,
    system: "backend:sensors",
    title: `Sensor Disarmed: ${sensor.name} in ${sensor.building}`,
  });
  res.json({ status: "success", message: "Sensor disarmed" });
});

export default router;
