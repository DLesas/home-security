import express from "express";
import { z } from "zod";
import { doorSensorRepository, type doorSensor } from "../../redis/doorSensors.js";
import { changeSensorStatus } from "../../sensorFuncs.js";
import { db, writePostgresCheckpoint } from "../../db/db.js";
import { sensorsTable } from "../../db/schema/sensors.js";
import { buildingTable } from "../../db/schema/buildings.js";
import { eq } from "drizzle-orm";
import { raiseEvent } from "../../notifiy.js";
import { emitNewData } from "../socketHandler.js";
import { errorLogsTable } from "../../db/schema/errorLogs.js";
import { alarmsTable } from "../../db/schema/alarms.js";
import { type Alarm, alarmRepository } from "../../redis/alarms.js";
import { EntityId } from "redis-om";
import { raiseError } from "../../errorHandling.js";
import { makeID } from "../../utils.js";
import { alarmLogsTable } from "../../db/schema/alarmLogs.js";
import { alarmUpdatesTable } from "../../db/schema/alarmUpdates.js";
import { writeRedisCheckpoint } from "../../redis/index.js";

const router = express.Router();

/**
 * @route POST /new
 * @description Creates a new alarm
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @requires {string} name - The name of the alarm (1-255 characters)
 * @requires {string} building - The name of the building (1-255 characters)
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
        raiseError(400, JSON.stringify(result.error.errors));
        return;
    }
    const { name, building, expectedSecondsUpdated } = result.data;
    const buildingExists = await db.select().from(buildingTable).where(eq(buildingTable.name, building)).limit(1);
    if (buildingExists.length === 0) {
        raiseError(404, "Building not found");
    }
    const [newAlarm] = await db
        .insert(alarmsTable)
        .values({
            id: makeID(),
            name,
            buildingId: buildingExists[0].id,
        })
        .returning();
    const { buildingId, ...newAlarmData } = newAlarm;
    const data = {id: newAlarm.id, name: newAlarm.name, expectedSecondsUpdated}
    await alarmRepository.save({
        name: name,
        externalID: newAlarm.id,
        building: building,
        playing: false,
        expectedSecondsUpdated: expectedSecondsUpdated,
        lastUpdated: new Date(),
    } as Alarm);
    await raiseEvent("info", `New alarm ${newAlarm.name} in ${building} with id ${newAlarm.id} added`);
    await writePostgresCheckpoint();
    await writeRedisCheckpoint();
    await emitNewData();
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
router.delete("/:alarmId", async (req, res) => {
    const { alarmId } = req.params;
    const alarm = await alarmRepository.search().where("externalID").eq(alarmId).returnFirst();
    if (!alarm) {
        raiseError(404, "Alarm not found");
        return;
    }
    const entityId = (alarm as any)[EntityId] as string;
    await db.update(alarmsTable).set({ deleted: true }).where(eq(alarmsTable.id, alarmId));
    await alarmRepository.remove(entityId);
    await emitNewData();
    await writePostgresCheckpoint();
    await writeRedisCheckpoint();
    res.json({ status: "success", message: "Alarm deleted" });
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
router.post("/logs", async (req, res) => {
	const logSchema = z.object({
		Timestamp: z.string().refine((val) => !isNaN(Date.parse(val)), {
			message: "Timestamp must be a valid date string",
		}),
		Type: z.string().min(1, "Type is required"),
		Class: z.string().min(1, "Class is required"),
		Function: z.string().min(1, "Function is required"),
		Error_Message: z.string().min(1, "Error_Message is required"),
		Hash: z.string().regex(/^[a-f0-9]{64}$/, "Hash must be a valid SHA-256 hash"),
		Count: z.number().int().min(1, "Count must be a positive integer"),
	});
	const validationSchema = z.array(logSchema);

	const result = validationSchema.safeParse(req.body);
	if (!result.success) {
		raiseError(400, JSON.stringify(result.error.errors));
		return;
	}
	const ipAddress = req.ip;
	if (!ipAddress) {
		raiseError(400, "ip Address is required");
		return;
	}
	const alarm = await alarmRepository.search().where("ipAddress").eq(ipAddress).returnFirst() as Alarm | null;
	if (!alarm) {
		raiseError(404, "Sensor not recognized");
		return;
	}
	await db.insert(alarmLogsTable).values(result.data.map(item => ({
		alarmId: alarm.externalID,
		function: item.Function,
		dateTime: new Date(item.Timestamp),
		hash: item.Hash,
		class: item.Class,
		type: item.Type,
		errorMessage: item.Error_Message,
		count: item.Count
	})));
	await raiseEvent("info", `Logs received from alarm ${alarm.name} in ${alarm.building}`);
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
router.post("/:alarmId/handshake", async (req, res) => {
    const { alarmId } = req.params;
    const validationSchema = z.object({
        macAddress: z
            .string({
                required_error: "macAddress is required",
                invalid_type_error: "macAddress must be a string",
            })
            .min(1, "macAddress must be at least 1 character")
            .max(255, "macAddress must be less than 255 characters"),
    });

    const result = validationSchema.safeParse(req.body);
    if (!result.success) {
        raiseError(400, JSON.stringify(result.error.errors));
        return;
    }
    const { macAddress } = result.data;
    const alarm = (await alarmRepository.search().where("externalID").eq(alarmId).returnFirst()) as Alarm | null;
    if (!alarm) {
        raiseError(404, "Alarm not found");
        return;
    }
    if (!alarm.ipAddress) {
        await alarmRepository.save({
            ...alarm,
            macAddress,
            ipAddress: req.ip,
            lastUpdated: new Date(),
        } as Alarm);
        await raiseEvent(
            "info",
            `Recieved first handshake from Alarm ${alarm.name} in ${alarm.building} with ip: ${req.ip} , and mac: ${macAddress}`
        );
        await emitNewData();
    }
    res.status(200).json({ status: "success", message: "Alarm handshake successful" });
});

router.post("/update", async (req, res) => {
	const validationSchema = z.object({
		status: z.enum(["on", "off"], {
			required_error: "status is required",
			invalid_type_error: "status must be one of: on, off",
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
				invalid_type_error: "voltage must be a number",
			}).optional().nullable(),
		frequency: z
			.number({
				invalid_type_error: "frequency must be a number",
			}).optional().nullable(),
	});
	const result = validationSchema.safeParse(req.body);
	if (!result.success) {
		raiseError(400, JSON.stringify(result.error.errors));
		return;
	}
	const ipAddress = req.ip;
	if (!ipAddress) {
		raiseError(400, "ip Address is required");
		return;
	}
	const alarm = await alarmRepository.search().where("ipAddress").eq(ipAddress).returnFirst() as Alarm | null;
	if (!alarm) {
		raiseError(404, "Alarm not recognized");
		return;
	}
	const { status, temperature, voltage, frequency } = result.data;
    await db.insert(alarmUpdatesTable).values({
        alarmId: alarm.externalID,
        state: status,
        temperature: temperature.toString(),
        voltage: voltage ? voltage.toString() : null,
        frequency: frequency,
    });
	await alarmRepository.save({
		...alarm,
		status,
		temperature,
		voltage,
		frequency,
		lastUpdated: new Date(),
	});
	await emitNewData();
	res.json({ status: "success", message: "update acknowledged" });
});

export default router;
