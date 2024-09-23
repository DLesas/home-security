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
import { alarmsTable } from "../../db/schema/alarms";
import { type Alarm, alarmRepository } from "../../redis/alarms";
import { EntityId } from "redis-om";
import { raiseError } from "../../errorHandling";
import { makeID } from "../../utils";

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
    await alarmRepository.save({
        name: name,
        externalID: newAlarm.id,
        building: building,
        playing: false,
        created: new Date(),
    } as Alarm);
    await raiseEvent("info", `New alarm ${newAlarm.name} in ${building} with id ${newAlarm.id} added`);
    res.status(201).json({ status: "success", data: newAlarmData });
});

/**
 * @route DELETE /:id
 * @description Deletes an alarm by ID
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @requires {string} id - The ID of the alarm to delete
 */
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    const alarm = await alarmRepository.search().where("externalID").eq(id).returnFirst();
    if (!alarm) {
        raiseError(404, "Alarm not found");
        return;
    }
    const entityId = (alarm as any)[EntityId] as string;
    await alarmRepository.remove(entityId);
    res.json({ status: "success", message: "Alarm deleted" });
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
        } as Alarm);
        await raiseEvent(
            "info",
            `Recieved first handshake from Alarm ${alarm.name} in ${alarm.building} with ip: ${req.ip} , and mac: ${macAddress}`
        );
        await emitNewData();
    }
    res.status(200).json({ status: "success", message: "Alarm handshake successful" });
});

export default router;
