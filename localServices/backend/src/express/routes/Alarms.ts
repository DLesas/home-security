import express from "express";
import { z } from "zod";
import { db, writePostgresCheckpoint } from "../../db/db";
import { buildingTable } from "../../db/schema/buildings";
import { eq, and, desc } from "drizzle-orm";
import { raiseEvent } from "../../events/notify";
import { emitNewData } from "../socketHandler";
import { alarmsTable } from "../../db/schema/alarms";
import { type Alarm, alarmRepository } from "../../redis/alarms";
import { redis } from "../../redis/index";
import { raiseError } from "../../events/notify";
import { makeID, truncateFromBeginning } from "../../utils/index";
import { alarmLogsTable } from "../../db/schema/alarmLogs";
import { alarmUpdatesTable } from "../../db/schema/alarmUpdates";
import { writeRedisCheckpoint } from "../../redis/index";
import { identifyDevice } from "../../utils/deviceIdentification";
import { sensorTimeoutMonitor } from "../../microDeviceTimeoutMonitor";
import { changeAlarmState } from "../../alarmFuncs";
import { retryWithExponentialBackoff } from "../../utils/index";

const router = express.Router();

/**
 * @route POST /new
 * @description Creates a new alarm
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @requires {string} name - The name of the alarm (1-255 characters)
 * @requires {string} building - The name of the building (1-255 characters)
 * @requires {number} expectedSecondsUpdated - Expected update interval in seconds (0-86400)
 * @requires {number} port - Port number for the alarm (1-65535)
 * @requires {number} autoTurnOffSeconds - Auto turn-off timeout in seconds (0 = no timeout, max 86400)
 */
router.post("/new", async (req, res, next) => {
  const validationSchema = z.object({
    name: z
      .string()
      .min(1, "name must be at least 1 character")
      .max(255, "name must be less than 255 characters"),
    building: z
      .string()
      .min(1, "building must be at least 1 character")
      .max(255, "building must be less than 255 characters"),
    expectedSecondsUpdated: z
      .number()
      .min(0, "expectedSecondsUpdated must be more than 0 seconds")
      .max(3600 * 24, "expectedSecondsUpdated must be less than 24 hours"),
    port: z
      .number()
      .min(1, "port must be more than 0")
      .max(65535, "port must be less than 65535"),
    autoTurnOffSeconds: z
      .number()
      .min(0, "autoTurnOffSeconds must be 0 or greater (0 = no timeout)")
      .max(
        86400,
        "autoTurnOffSeconds must be less than 24 hours (86400 seconds)"
      ),
  });
  const result = validationSchema.safeParse(req.body);
  if (!result.success) {
    next(raiseError(400, JSON.stringify(result.error.issues)));
    return;
  }
  const { name, building, expectedSecondsUpdated, port, autoTurnOffSeconds } =
    result.data;
  const buildingExists = await db
    .select()
    .from(buildingTable)
    .where(eq(buildingTable.name, building))
    .limit(1);
  if (buildingExists.length === 0) {
    next(raiseError(404, "Building not found"));
    return;
  }
  const [newAlarm] = await db
    .insert(alarmsTable)
    .values({
      id: makeID(),
      name,
      buildingId: buildingExists[0].id,
      port,
    })
    .returning();
  const { buildingId, ...newAlarmData } = newAlarm;
  const data = {
    id: newAlarm.id,
    name: newAlarm.name,
    expectedSecondsUpdated,
    autoTurnOffSeconds,
  };
  // Save with explicit ID to avoid duplicate entities
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
  await emitNewData();
  await raiseEvent({
    type: "info",
    message: `New alarm ${newAlarm.name} in ${building} with id ${newAlarm.id} added`,
    system: "backend:alarms",
  });
  await writePostgresCheckpoint();
  await writeRedisCheckpoint();
  await sensorTimeoutMonitor.recreateAllIntervals();
  res.status(201).json({ status: "success", data: data });
});

/**
 * @route DELETE /:id
 * @description Deletes an alarm by ID
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @requires {string} id - The ID of the alarm to delete
 */
router.delete("/:alarmId", async (req, res, next) => {
  const { alarmId } = req.params;
  const alarm = await alarmRepository
    .search()
    .where("externalID")
    .eq(alarmId)
    .returnFirst();
  if (!alarm) {
    next(raiseError(404, "Alarm not found"));
    return;
  }

  // Hard delete in PostgreSQL
  await db
    .delete(alarmsTable)
    .where(eq(alarmsTable.id, alarmId));

  // Remove alarm directly from Redis using the key format: alarms:{alarmId}
  const alarmKey = `alarms:${alarmId}`;
  const deleted = await redis.del(alarmKey);
  console.log(`[AlarmDelete] Deleted key ${alarmKey}: ${deleted} keys removed`);

  await emitNewData();
  await raiseEvent({
    type: "warning",
    message: `Alarm ${alarm.name} in ${alarm.building} deleted`,
    system: "backend:alarms",
  });
  await writePostgresCheckpoint();
  await writeRedisCheckpoint();
  await sensorTimeoutMonitor.recreateAllIntervals();
  res.status(200).json({ status: "success", message: "Alarm deleted" });
});

/**
 * @route POST /logs
 * @description Logs error messages from an alarm
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
    last_seen: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "last_seen must be a valid date string",
      })
      .optional(),
  });
  const validationSchema = z.array(logSchema);

  const result = validationSchema.safeParse(req.body);
  if (!result.success) {
    next(raiseError(400, JSON.stringify(result.error.issues)));
    return;
  }

  // Try to identify device using headers first, then fallback to IP
  const deviceInfo = await identifyDevice(req);
  if (!deviceInfo || deviceInfo.type !== "alarm") {
    next(
      raiseError(
        404,
        "Alarm not recognized - ensure device headers are set correctly"
      )
    );
    return;
  }

  const alarm = (await alarmRepository
    .search()
    .where("externalID")
    .eq(deviceInfo.id)
    .returnFirst()) as Alarm | null;

  if (!alarm) {
    next(raiseError(404, "Alarm not found in database"));
    return;
  }

  await db.insert(alarmLogsTable).values(
    result.data.map((item) => ({
      alarmId: alarm.externalID,
      function: item.Function,
      dateTime: new Date(item.Timestamp),
      hash: item.Hash,
      class: item.Class,
      type: item.Type,
      errorMessage: truncateFromBeginning(item.Error_Message, 2000),
      count: item.Count,
      last_seen: item.last_seen ? new Date(item.last_seen) : null,
    }))
  );

  await raiseEvent({
    type: "debug",
    message: `Logs received from alarm ${alarm.name} in ${alarm.building} (identified by: ${deviceInfo.identificationMethod})`,
    system: "backend:alarms",
  });
  res.json({ status: "success", message: "Logs received" });
});

/**
 * @route POST /:alarmId/handshake
 * @description Handles the handshake for an alarm
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @requires {string} macAddress - The MAC address of the alarm (1-255 characters)
 */
router.post("/:alarmId/handshake", async (req, res, next) => {
  const { alarmId } = req.params;
  const validationSchema = z.object({
    macAddress: z
      .string()
      .min(1, "macAddress must be at least 1 character")
      .max(255, "macAddress must be less than 255 characters"),
  });

  const result = validationSchema.safeParse(req.body);
  if (!result.success) {
    next(raiseError(400, JSON.stringify(result.error.issues)));
    return;
  }
  const { macAddress } = result.data;

  // Try to identify device using headers first, then fallback to URL param
  const deviceInfo = await identifyDevice(req);
  const targetAlarmId = deviceInfo?.id || alarmId;
  const deviceIp = deviceInfo?.ipAddress;

  const alarm = (await alarmRepository
    .search()
    .where("externalID")
    .eq(targetAlarmId)
    .returnFirst()) as Alarm | null;

  if (!alarm) {
    console.log(`Alarm not found with ID: ${targetAlarmId}`);
    console.log(
      "Available alarms:",
      await alarmRepository.search().returnAll()
    );
    next(raiseError(404, "Alarm not found"));
    return;
  }

  await emitNewData();
  const identificationMethod = deviceInfo?.identificationMethod || "url_param";
  await raiseEvent({
    type: "debug",
    message: `Received handshake from alarm ${alarm.name} in ${alarm.building} (identified by: ${identificationMethod}) with ip: ${deviceIp}, mac: ${macAddress}`,
    system: "backend:alarms",
  });
  res
    .status(200)
    .json({ status: "success", message: "Alarm handshake successful" });
});

/**
 * @route POST /update
 * @description Updates the status and temperature of an alarm
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @body {string} status - The status of the alarm (on, off)
 * @body {number} temperature - The temperature reading of the alarm (-100 to 120)
 */
router.post("/update", async (req, res, next) => {
  const validationSchema = z.object({
    state: z.enum(["on", "off"]),
    temperature: z
      .number()
      .min(-100, "implausible temperature")
      .max(120, "implausible temperature"),
    voltage: z
      .number()
      .optional()
      .nullable(),
    frequency: z
      .number()
      .optional()
      .nullable(),
  });
  const result = validationSchema.safeParse(req.body);
  if (!result.success) {
    next(raiseError(400, JSON.stringify(result.error.issues)));
    return;
  }

  // Try to identify device using headers first, then fallback to IP
  const deviceInfo = await identifyDevice(req);
  if (!deviceInfo || deviceInfo.type !== "alarm") {
    next(
      raiseError(
        404,
        "Alarm not recognized - ensure device headers are set correctly"
      )
    );
    return;
  }

  const alarm = (await alarmRepository
    .search()
    .where("externalID")
    .eq(deviceInfo.id)
    .returnFirst()) as Alarm | null;

  if (!alarm) {
    next(raiseError(404, "Alarm not found in database"));
    return;
  }

  const { state, temperature, voltage, frequency } = result.data;
  await alarmRepository.save(alarm.externalID, {
    ...alarm,
    state: state,
    temperature,
    voltage,
    frequency,
    lastUpdated: new Date(),
  });
  await emitNewData();

  await db.insert(alarmUpdatesTable).values({
    alarmId: alarm.externalID,
    state: state,
    temperature: temperature.toString(),
    voltage: voltage ? voltage.toString() : null,
    frequency: frequency,
  });

  await raiseEvent({
    type: "debug",
    message: `Alarm ${alarm.name} in ${alarm.building} (identified by: ${deviceInfo.identificationMethod}) updated with state: ${state}, temperature: ${temperature}, voltage: ${voltage}, frequency: ${frequency}`,
    system: "backend:alarms",
  });

  res.json({ status: "success", message: "update acknowledged" });
});

/**
 * @route POST /:alarmId/test
 * @description Tests an alarm by turning it on for 0.75 seconds then turning it off
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @requires {string} alarmId - The ID of the alarm to test
 */
router.post("/:alarmId/test", async (req, res, next) => {
  const { alarmId } = req.params;

  const alarm = (await alarmRepository
    .search()
    .where("externalID")
    .eq(alarmId)
    .returnFirst()) as Alarm | null;

  if (!alarm) {
    next(raiseError(404, "Alarm not found"));
    return;
  }

  // Turn alarm on
  const turnOnResult = await changeAlarmState([alarm], "on");

  if (turnOnResult.isErr()) {
    next(raiseError(500, `Failed to turn on alarm: ${turnOnResult.error}`));
    return;
  }

  await emitNewData();

  await raiseEvent({
    type: "info",
    message: `Testing alarm ${alarm.name} in ${alarm.building}`,
    system: "backend:alarms",
  });

  // Wait 750ms
  await new Promise((resolve) => setTimeout(resolve, 650));

  // Turn alarm off with exponential backoff retries
  const turnOffResult = await retryWithExponentialBackoff(
    () => changeAlarmState([alarm], "off"),
    5, // max retries
    100, // initial delay
    1000 // max delay
  );

  if (turnOffResult.isErr()) {
    await raiseEvent({
      type: "critical",
      message: `Failed to turn off alarm ${alarm.name} after test: ${turnOffResult.error}`,
      system: "backend:alarms",
    });
    next(raiseError(500, `Failed to turn off alarm: ${turnOffResult.error}`));
    return;
  }

  await emitNewData();

  await raiseEvent({
    type: "info",
    message: `Test completed for alarm ${alarm.name} in ${alarm.building}`,
    system: "backend:alarms",
  });

  res.status(200).json({
    status: "success",
    message: "Alarm test completed successfully",
  });
});

/**
 * @route GET /:alarmId/updates
 * @description Gets paginated updates for an alarm
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @urlparam {string} alarmId - The ID of the alarm
 * @queryparam {number} limit - Number of updates per page (default: 100, max: 1000)
 * @queryparam {number} offset - Number of updates to skip (default: 0)
 */
router.get("/:alarmId/updates", async (req, res, next) => {
  const { alarmId } = req.params;

  // Validate query parameters
  const querySchema = z.object({
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 100))
      .refine((val) => !isNaN(val) && val > 0 && val <= 1000, {
        message: "limit must be a number between 1 and 1000",
      }),
    offset: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 0))
      .refine((val) => !isNaN(val) && val >= 0, {
        message: "offset must be a non-negative number",
      }),
  });

  const result = querySchema.safeParse(req.query);
  if (!result.success) {
    next(raiseError(400, JSON.stringify(result.error.issues)));
    return;
  }

  const { limit, offset } = result.data;

  // Verify alarm exists
  const alarm = (await alarmRepository
    .search()
    .where("externalID")
    .eq(alarmId)
    .returnFirst()) as Alarm | null;

  if (!alarm) {
    next(raiseError(404, "Alarm not recognized"));
    return;
  }

  // Build where conditions
  const whereConditions = [eq(alarmUpdatesTable.alarmId, alarmId)];

  // Get the paginated updates for this alarm
  const updates = await db
    .select()
    .from(alarmUpdatesTable)
    .where(and(...whereConditions))
    .orderBy(desc(alarmUpdatesTable.dateTime))
    .limit(limit)
    .offset(offset);

  // Map the updates to include playing boolean based on state
  const mappedUpdates = updates.map((update) => ({
    ...update,
    playing: update.state === "on",
  }));

  res.json({
    status: "success",
    limit,
    offset,
    count: mappedUpdates.length,
    updates: mappedUpdates,
  });
});

export default router;
