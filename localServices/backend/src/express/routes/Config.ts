import express from "express";
import { z } from "zod";
import {
  configRepository,
  CONFIG_ENTITY_ID,
  publishConfigChange,
  OBJECT_DETECTION_MODELS,
} from "../../redis/config";
import { raiseEvent, raiseError } from "../../events/notify";
import { emitNewData } from "../socketHandler";

const router = express.Router();

// Validation schema for full config updates
const configUpdateSchema = z.object({
  // Sensor temperature thresholds
  sensorWarningTemparature: z.number().int().min(0).max(150).optional(),
  sensorCriticalTemparature: z.number().int().min(0).max(150).optional(),
  // Object detection global settings
  objectDetectionModel: z.enum(OBJECT_DETECTION_MODELS).optional(),
  clipPreDuration: z.number().int().min(0).max(300).optional(),
  clipPostDuration: z.number().int().min(0).max(300).optional(),
});

/**
 * @route GET /
 * @description Get global configuration
 */
router.get("/", async (req, res, next) => {
  try {
    const config = await configRepository.fetch(CONFIG_ENTITY_ID);

    if (!config) {
      next(raiseError(404, "Config not found"));
      return;
    }

    res.status(200).json({
      success: true,
      config,
    });
  } catch (err) {
    console.error("Error fetching config:", err);
    next(raiseError(500, "Failed to fetch config"));
  }
});

/**
 * @route PUT /
 * @description Update global configuration
 * @body { sensorWarningTemparature?, sensorCriticalTemparature?, objectDetectionModel?, clipPreDuration?, clipPostDuration? }
 */
router.put("/", async (req, res, next) => {
  const { error, data: updates } = configUpdateSchema.safeParse(req.body);
  if (error) {
    next(raiseError(400, JSON.stringify(error.issues)));
    return;
  }

  // Check at least one field is being updated
  if (Object.keys(updates).length === 0) {
    next(raiseError(400, "No fields to update"));
    return;
  }

  try {
    const existingConfig = await configRepository.fetch(CONFIG_ENTITY_ID);

    if (!existingConfig) {
      next(raiseError(404, "Config not found"));
      return;
    }

    // Merge updates with existing config
    const updatedConfig = {
      ...existingConfig,
      ...updates,
    };

    await configRepository.save(CONFIG_ENTITY_ID, updatedConfig);

    // Publish config change event for services watching config
    await publishConfigChange();

    // Emit to frontend clients
    await emitNewData();

    // Raise audit event
    await raiseEvent({
      type: "info",
      message: `Config updated: ${JSON.stringify(updates)}`,
      system: "backend:config",
    });

    res.status(200).json({
      success: true,
      config: updatedConfig,
    });
  } catch (err) {
    console.error("Error updating config:", err);
    next(raiseError(500, "Failed to update config"));
  }
});

export default router;
