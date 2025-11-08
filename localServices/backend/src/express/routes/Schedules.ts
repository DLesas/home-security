import express from "express";
import { z } from "zod";
import {
  recurringScheduleRepository,
  oneTimeScheduleRepository,
  type RecurringSchedule,
  type OneTimeSchedule,
} from "../../redis/schedules";
import { raiseEvent } from "../../events/notify";
import { raiseError } from "../../events/notify";
import { emitNewData } from "../socketHandler";
import { makeID } from "../../utils/index";
import { scheduleManager } from "../../scheduleManager";

const router = express.Router();

/**
 * @route POST /new
 * @description Creates a new unified schedule (recurring or one-time)
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @body {object} schedule - Unified schedule object (recurring or one-time)
 */
router.post("/new", async (req, res, next) => {
  // Recurring schedule validation schema
  const recurringScheduleSchema = z.object({
    type: z.literal("recurring"),
    name: z
      .string({
        required_error: "name is required",
        invalid_type_error: "name must be a string",
      })
      .min(1, "name must be at least 1 character")
      .max(255, "name must be less than 255 characters"),
    sensorIds: z
      .array(z.string())
      .min(1, "At least one sensor must be selected"),
    armTime: z
      .string({
        required_error: "armTime is required",
        invalid_type_error: "armTime must be a string",
      })
      .regex(/^\d{2}:\d{2}$/, "armTime must be in HH:MM format"),
    armDayOffset: z
      .number({
        required_error: "armDayOffset is required",
        invalid_type_error: "armDayOffset must be a number",
      })
      .int("armDayOffset must be an integer"),
    disarmTime: z
      .string({
        required_error: "disarmTime is required",
        invalid_type_error: "disarmTime must be a string",
      })
      .regex(/^\d{2}:\d{2}$/, "disarmTime must be in HH:MM format"),
    disarmDayOffset: z
      .number({
        required_error: "disarmDayOffset is required",
        invalid_type_error: "disarmDayOffset must be a number",
      })
      .int("disarmDayOffset must be an integer"),
    recurrence: z.enum(["Daily", "Weekly"], {
      required_error: "recurrence is required",
      invalid_type_error: "recurrence must be either 'Daily' or 'Weekly'",
    }),
    days: z.array(z.string()).optional(),
    active: z.boolean().default(true),
  });

  // One-time schedule validation schema
  const oneTimeScheduleSchema = z.object({
    type: z.literal("oneTime"),
    name: z
      .string({
        required_error: "name is required",
        invalid_type_error: "name must be a string",
      })
      .min(1, "name must be at least 1 character")
      .max(255, "name must be less than 255 characters"),
    sensorIds: z
      .array(z.string())
      .min(1, "At least one sensor must be selected"),
    armDateTime: z
      .string({
        required_error: "armDateTime is required",
        invalid_type_error: "armDateTime must be a string",
      })
      .datetime("armDateTime must be a valid ISO datetime"),
    disarmDateTime: z
      .string({
        required_error: "disarmDateTime is required",
        invalid_type_error: "disarmDateTime must be a string",
      })
      .datetime("disarmDateTime must be a valid ISO datetime"),
  });

  const validationSchema = z.discriminatedUnion("type", [
    recurringScheduleSchema,
    oneTimeScheduleSchema,
  ]);

  const result = validationSchema.safeParse(req.body);
  if (!result.success) {
    next(raiseError(400, JSON.stringify(result.error.errors)));
    return;
  }

  const schedule = result.data;
  const scheduleId = makeID();

  try {
    if (schedule.type === "recurring") {
      // Create recurring schedule
      const daysToSave =
        schedule.recurrence === "Weekly"
          ? JSON.stringify(schedule.days || [])
          : undefined;

      await recurringScheduleRepository.save(scheduleId, {
        id: scheduleId,
        name: schedule.name,
        sensorIDs: schedule.sensorIds,
        armTime: schedule.armTime,
        armDayOffset: schedule.armDayOffset,
        disarmTime: schedule.disarmTime,
        disarmDayOffset: schedule.disarmDayOffset,
        recurrence: schedule.recurrence,
        days: daysToSave,
        active: schedule.active,
        createdAt: new Date(),
        lastModified: new Date(),
      } as RecurringSchedule);

      await raiseEvent({
        type: "info",
        message: `New recurring schedule "${schedule.name}" created for ${schedule.sensorIds.length} sensor(s)`,
        system: "backend:schedules",
      });
    } else {
      // Create one-time schedule
      await oneTimeScheduleRepository.save(scheduleId, {
        id: scheduleId,
        name: schedule.name,
        sensorIDs: schedule.sensorIds,
        armDateTime: new Date(schedule.armDateTime),
        disarmDateTime: new Date(schedule.disarmDateTime),
        createdAt: new Date(),
      } as OneTimeSchedule);

      await raiseEvent({
        type: "info",
        message: `New one-time schedule "${schedule.name}" created for ${schedule.sensorIds.length} sensor(s)`,
        system: "backend:schedules",
      });
    }

    // Reset schedule manager to recalculate timeouts
    await scheduleManager.resetSchedules();

    // Emit updated data via socket
    await emitNewData();

    res.status(201).json({
      status: "success",
      message: "Schedule created successfully",
      scheduleId,
    });
  } catch (error) {
    console.error("Error creating schedule:", error);
    next(raiseError(500, "Failed to create schedule"));
  }
});

/**
 * @route PUT /:scheduleId
 * @description Updates an existing schedule
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @urlparam {string} scheduleId - The ID of the schedule to update
 */
router.put("/:scheduleId", async (req, res, next) => {
  const { scheduleId } = req.params;

  // Partial update schema for recurring schedules
  const recurringUpdateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    sensorIds: z
      .array(z.string())
      .min(1, "At least one sensor must be selected")
      .optional(),
    armTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "armTime must be in HH:MM format")
      .optional(),
    armDayOffset: z.number().int("armDayOffset must be an integer").optional(),
    disarmTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "disarmTime must be in HH:MM format")
      .optional(),
    disarmDayOffset: z.number().int("disarmDayOffset must be an integer").optional(),
    recurrence: z.enum(["Daily", "Weekly"]).optional(),
    days: z.array(z.string()).optional(),
    active: z.boolean().optional(),
  });

  // Partial update schema for one-time schedules
  const oneTimeUpdateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    sensorIds: z
      .array(z.string())
      .min(1, "At least one sensor must be selected")
      .optional(),
    armDateTime: z.string().datetime("armDateTime must be a valid ISO datetime").optional(),
    disarmDateTime: z.string().datetime("disarmDateTime must be a valid ISO datetime").optional(),
  });

  try {
    // Try to find in recurring schedules first
    let existingSchedule: RecurringSchedule | OneTimeSchedule | null =
      (await recurringScheduleRepository
        .search()
        .where("id")
        .eq(scheduleId)
        .returnFirst()) as RecurringSchedule | null;

    let isRecurring = true;

    if (!existingSchedule) {
      // Try one-time schedules
      existingSchedule = (await oneTimeScheduleRepository
        .search()
        .where("id")
        .eq(scheduleId)
        .returnFirst()) as OneTimeSchedule | null;
      isRecurring = false;
    }

    if (!existingSchedule) {
      next(raiseError(404, "Schedule not found"));
      return;
    }

    // Validate updates based on schedule type
    let updates;
    if (isRecurring) {
      const result = recurringUpdateSchema.safeParse(req.body);
      if (!result.success) {
        next(raiseError(400, JSON.stringify(result.error.errors)));
        return;
      }
      updates = result.data;
    } else {
      const result = oneTimeUpdateSchema.safeParse(req.body);
      if (!result.success) {
        next(raiseError(400, JSON.stringify(result.error.errors)));
        return;
      }
      updates = result.data;
    }

    // Apply updates
    if (isRecurring) {
      const recurringUpdates = updates as z.infer<typeof recurringUpdateSchema>;
      const recurringSchedule = existingSchedule as RecurringSchedule;

      const updatedSchedule: RecurringSchedule = {
        id: recurringSchedule.id,
        name: recurringUpdates.name ?? recurringSchedule.name,
        sensorIDs: recurringUpdates.sensorIds ?? recurringSchedule.sensorIDs,
        armTime: recurringUpdates.armTime ?? recurringSchedule.armTime,
        armDayOffset: recurringUpdates.armDayOffset ?? recurringSchedule.armDayOffset,
        disarmTime: recurringUpdates.disarmTime ?? recurringSchedule.disarmTime,
        disarmDayOffset: recurringUpdates.disarmDayOffset ?? recurringSchedule.disarmDayOffset,
        recurrence: recurringUpdates.recurrence ?? recurringSchedule.recurrence,
        active: recurringUpdates.active ?? recurringSchedule.active,
        createdAt: recurringSchedule.createdAt,
        lastModified: new Date(),
        days: recurringSchedule.days, // Will be updated below if needed
      };

      // Handle days field for weekly schedules
      if (recurringUpdates.days !== undefined) {
        updatedSchedule.days = JSON.stringify(recurringUpdates.days);
      }

      await recurringScheduleRepository.save(scheduleId, updatedSchedule);
    } else {
      const oneTimeUpdates = updates as z.infer<typeof oneTimeUpdateSchema>;
      const oneTimeSchedule = existingSchedule as OneTimeSchedule;

      const updatedSchedule: OneTimeSchedule = {
        id: oneTimeSchedule.id,
        name: oneTimeUpdates.name ?? oneTimeSchedule.name,
        sensorIDs: oneTimeUpdates.sensorIds ?? oneTimeSchedule.sensorIDs,
        armDateTime: oneTimeUpdates.armDateTime ? new Date(oneTimeUpdates.armDateTime) : oneTimeSchedule.armDateTime,
        disarmDateTime: oneTimeUpdates.disarmDateTime ? new Date(oneTimeUpdates.disarmDateTime) : oneTimeSchedule.disarmDateTime,
        createdAt: oneTimeSchedule.createdAt,
      };

      await oneTimeScheduleRepository.save(scheduleId, updatedSchedule);
    }

    await raiseEvent({
      type: "info",
      message: `Schedule "${existingSchedule.name}" updated`,
      system: "backend:schedules",
    });

    // Reset schedule manager to recalculate timeouts
    await scheduleManager.resetSchedules();

    // Emit updated data via socket
    await emitNewData();

    res.status(200).json({
      status: "success",
      message: "Schedule updated successfully",
    });
  } catch (error) {
    console.error("Error updating schedule:", error);
    next(raiseError(500, "Failed to update schedule"));
  }
});

/**
 * @route DELETE /:scheduleId
 * @description Deletes a schedule
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @urlparam {string} scheduleId - The ID of the schedule to delete
 */
router.delete("/:scheduleId", async (req, res, next) => {
  const { scheduleId } = req.params;

  try {
    // Try to find in recurring schedules first
    let existingSchedule: RecurringSchedule | OneTimeSchedule | null =
      (await recurringScheduleRepository
        .search()
        .where("id")
        .eq(scheduleId)
        .returnFirst()) as RecurringSchedule | null;

    let isRecurring = true;

    if (!existingSchedule) {
      // Try one-time schedules
      existingSchedule = (await oneTimeScheduleRepository
        .search()
        .where("id")
        .eq(scheduleId)
        .returnFirst()) as OneTimeSchedule | null;
      isRecurring = false;
    }

    if (!existingSchedule) {
      next(raiseError(404, "Schedule not found"));
      return;
    }

    // Delete the schedule
    if (isRecurring) {
      await recurringScheduleRepository.remove(scheduleId);
      console.log(`Deleted recurring schedule: ${scheduleId}`);
    } else {
      await oneTimeScheduleRepository.remove(scheduleId);
      console.log(`Deleted one-time schedule: ${scheduleId}`);
    }

    await raiseEvent({
      type: "warning",
      message: `Schedule "${existingSchedule.name}" deleted`,
      system: "backend:schedules",
    });

    // Reset schedule manager to clear timeouts
    await scheduleManager.resetSchedules();

    // Emit updated data via socket
    await emitNewData();

    res.status(200).json({
      status: "success",
      message: "Schedule deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    next(raiseError(500, "Failed to delete schedule"));
  }
});

/**
 * @route POST /:scheduleId/toggle
 * @description Enable or disable a recurring schedule
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @urlparam {string} scheduleId - The ID of the schedule to toggle
 */
router.post("/:scheduleId/toggle", async (req, res, next) => {
  const { scheduleId } = req.params;

  const validationSchema = z.object({
    active: z.boolean({
      required_error: "active is required",
      invalid_type_error: "active must be a boolean",
    }),
  });

  const result = validationSchema.safeParse(req.body);
  if (!result.success) {
    next(raiseError(400, JSON.stringify(result.error.errors)));
    return;
  }

  const { active } = result.data;

  try {
    // Only recurring schedules can be toggled
    const existingSchedule = (await recurringScheduleRepository
      .search()
      .where("id")
      .eq(scheduleId)
      .returnFirst()) as RecurringSchedule | null;

    if (!existingSchedule) {
      next(raiseError(404, "Recurring schedule not found"));
      return;
    }

    await recurringScheduleRepository.save(scheduleId, {
      ...existingSchedule,
      active,
      lastModified: new Date(),
    } as RecurringSchedule);

    const status = active ? "enabled" : "disabled";
    await raiseEvent({
      type: "info",
      message: `Schedule "${existingSchedule.name}" ${status}`,
      system: "backend:schedules",
    });

    // Reset schedule manager to add/remove timeouts
    await scheduleManager.resetSchedules();

    // Emit updated data via socket
    await emitNewData();

    res.status(200).json({
      status: "success",
      message: `Schedule ${status} successfully`,
    });
  } catch (error) {
    console.error("Error toggling schedule:", error);
    next(raiseError(500, "Failed to toggle schedule"));
  }
});

export default router;
