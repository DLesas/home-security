import express from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  cameraRepository,
  CameraProtocol,
  Camera,
  MotionZone,
} from "../../redis/cameras";
import { redis } from "../../redis/index";
import { raiseEvent, raiseError } from "../../events/notify";
import { emitNewData } from "../socketHandler";
import { publishCameraConfigChange } from "../../events/cameraConfigEvents";
import { db } from "../../db/db";
import { cameraTable, cameraSettingTable, motionZoneTable, buildingTable } from "../../db/schema/index";
import { makeID } from "../../utils/index";

// Zod schema for motion zone validation
const motionZoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  points: z.array(z.tuple([z.number(), z.number()])).default([]),
  minContourArea: z.number().int().min(1).default(1500),
  thresholdPercent: z.number().min(0).max(100).default(1.0),
});

const router = express.Router();

/**
 * @route POST /
 * @description Create a new camera in Redis
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @body Camera object with all required fields
 */
router.post("/", async (req, res, next) => {
  const validationSchema = z.object({
    name: z.string().min(1, "Camera name is required"),
    externalID: z.string().min(1, "External ID is required"),
    building: z.string().min(1, "Building is required"),
    ipAddress: z.string().min(1, "IP address is required"),
    port: z.number().int().min(1).max(65535, "Port must be between 1 and 65535"),
    protocol: z.enum(["udp", "rtsp"]).default("udp"),
    username: z.string().optional(),
    password: z.string().optional(),
    streamPath: z.string().optional(),
    expectedSecondsUpdated: z.number().int().min(1).default(30),
    // Target resolution (optional - if not set, uses native resolution from stream)
    targetWidth: z.number().int().min(1).optional(),
    targetHeight: z.number().int().min(1).optional(),
    // Motion detection settings
    motionDetectionEnabled: z.boolean().default(true),
    // MOG2 background subtractor settings (per-camera)
    mog2History: z.number().int().min(1).default(defaultMOG2Settings.mog2History),
    mog2VarThreshold: z.number().min(0).default(defaultMOG2Settings.mog2VarThreshold),
    mog2DetectShadows: z.boolean().default(defaultMOG2Settings.mog2DetectShadows),
    // Motion zones (optional - defaults to full frame zone)
    motionZones: z.array(motionZoneSchema).optional(),
  });

  const { error, data } = validationSchema.safeParse(req.body);
  if (error) {
    next(raiseError(400, JSON.stringify(error.errors)));
    return;
  }

  try {
    // Check if camera with this externalID already exists
    const existingCameras = await cameraRepository
      .search()
      .where("externalID")
      .eq(data.externalID)
      .return.all();

    if (existingCameras.length > 0) {
      next(raiseError(409, `Camera with externalID '${data.externalID}' already exists`));
      return;
    }

    // Look up building by ID and validate it exists
    const [building] = await db
      .select()
      .from(buildingTable)
      .where(eq(buildingTable.id, data.building))
      .limit(1);

    if (!building) {
      next(raiseError(404, `Building with ID '${data.building}' not found`));
      return;
    }

    // Use provided zones or create default full-frame zone
    const motionZones: MotionZone[] = data.motionZones && data.motionZones.length > 0
      ? data.motionZones
      : [createDefaultMotionZone()];

    // Create camera object for Redis (stores zones as JSON string)
    // Use building.name for Redis (consistent with sensors), buildingId for PostgreSQL
    const camera: Camera = {
      name: data.name,
      externalID: data.externalID,
      building: building.name,
      ipAddress: data.ipAddress,
      port: data.port,
      protocol: data.protocol as CameraProtocol,
      username: data.username,
      password: data.password,
      streamPath: data.streamPath,
      expectedSecondsUpdated: data.expectedSecondsUpdated,
      lastUpdated: new Date(),
      targetWidth: data.targetWidth,
      targetHeight: data.targetHeight,
      motionDetectionEnabled: data.motionDetectionEnabled,
      mog2History: data.mog2History,
      mog2VarThreshold: data.mog2VarThreshold,
      mog2DetectShadows: data.mog2DetectShadows,
      motionZones,
    };

    // Save camera to Redis (zones stored as JSON string via redis-om)
    await cameraRepository.save(data.externalID, {
      ...camera,
      motionZones: JSON.stringify(motionZones),
    });

    // Persist camera to PostgreSQL
    await db.insert(cameraTable).values({
      id: data.externalID,
      name: data.name,
      buildingId: data.building,
      ipAddress: data.ipAddress,
      port: data.port,
      protocol: data.protocol,
      username: data.username || null,
      password: data.password || null,
      streamPath: data.streamPath || null,
      createdAt: new Date(),
      lastUpdated: new Date(),
    }).onConflictDoUpdate({
      target: cameraTable.id,
      set: {
        name: data.name,
        buildingId: data.building,
        ipAddress: data.ipAddress,
        port: data.port,
        protocol: data.protocol,
        username: data.username || null,
        password: data.password || null,
        streamPath: data.streamPath || null,
        lastUpdated: new Date(),
      },
    });

    // Create initial camera settings in PostgreSQL
    const settingsId = makeID();
    await db.insert(cameraSettingTable).values({
      id: settingsId,
      cameraId: data.externalID,
      targetWidth: data.targetWidth || null,
      targetHeight: data.targetHeight || null,
      motionDetectionEnabled: data.motionDetectionEnabled,
      mog2History: data.mog2History,
      mog2VarThreshold: data.mog2VarThreshold,
      mog2DetectShadows: data.mog2DetectShadows,
      isCurrent: true,
      createdAt: new Date(),
    });

    // Create motion zones in PostgreSQL
    for (const zone of motionZones) {
      await db.insert(motionZoneTable).values({
        id: zone.id,
        cameraId: data.externalID,
        name: zone.name,
        points: zone.points,
        minContourArea: zone.minContourArea,
        thresholdPercent: zone.thresholdPercent,
        createdAt: new Date(),
        lastUpdated: new Date(),
      });
    }

    // Emit new data to all connected clients
    await emitNewData();

    // Publish camera config change for real-time updates to camera ingestion service
    await publishCameraConfigChange("created", camera);

    // Raise event for audit trail
    await raiseEvent({
      type: "info",
      message: `Camera '${data.name}' (${data.externalID}) created`,
      system: "backend:cameras",
    });

    res.status(201).json({
      success: true,
      entityId: data.externalID,
      camera: {
        ...camera,
        lastUpdated: camera.lastUpdated.toISOString(),
      },
    });
  } catch (err) {
    console.error("Error creating camera:", err);
    next(raiseError(500, "Failed to create camera"));
  }
});

/**
 * @route GET /
 * @description Get all cameras
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 */
router.get("/", async (req, res, next) => {
  try {
    const cameras = await cameraRepository.search().return.all();

    res.status(200).json({
      success: true,
      count: cameras.length,
      cameras,
    });
  } catch (err) {
    console.error("Error fetching cameras:", err);
    next(raiseError(500, "Failed to fetch cameras"));
  }
});

/**
 * @route PUT /:externalID
 * @description Update a camera's configuration
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 * @body Partial camera object with fields to update
 */
router.put("/:externalID", async (req, res, next) => {
  const { externalID } = req.params;

  const validationSchema = z.object({
    name: z.string().min(1).optional(),
    building: z.string().min(1).optional(),
    ipAddress: z.string().min(1).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    protocol: z.enum(["udp", "rtsp"]).optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    streamPath: z.string().optional(),
    expectedSecondsUpdated: z.number().int().min(1).optional(),
    targetWidth: z.number().int().min(1).optional(),
    targetHeight: z.number().int().min(1).optional(),
    motionDetectionEnabled: z.boolean().optional(),
    // MOG2 settings
    mog2History: z.number().int().min(1).optional(),
    mog2VarThreshold: z.number().min(0).optional(),
    mog2DetectShadows: z.boolean().optional(),
    // Motion zones (replaces all zones if provided)
    motionZones: z.array(motionZoneSchema).optional(),
  });

  const { error, data: updates } = validationSchema.safeParse(req.body);
  if (error) {
    next(raiseError(400, JSON.stringify(error.errors)));
    return;
  }

  try {
    // Find the camera
    const cameras = await cameraRepository
      .search()
      .where("externalID")
      .eq(externalID)
      .return.all();

    if (cameras.length === 0) {
      next(raiseError(404, `Camera with externalID '${externalID}' not found`));
      return;
    }

    const camera = cameras[0];

    // If building is being updated, look up the building name
    let buildingName: string | undefined;
    if (updates.building) {
      const [building] = await db
        .select()
        .from(buildingTable)
        .where(eq(buildingTable.id, updates.building))
        .limit(1);

      if (!building) {
        next(raiseError(404, `Building with ID '${updates.building}' not found`));
        return;
      }
      buildingName = building.name;
    }

    // Parse existing motion zones from Redis (stored as JSON string)
    let existingZones: MotionZone[] = [];
    if (camera.motionZones) {
      try {
        existingZones = typeof camera.motionZones === 'string'
          ? JSON.parse(camera.motionZones)
          : camera.motionZones;
      } catch {
        existingZones = [];
      }
    }

    // Use updated zones or keep existing
    const motionZones = updates.motionZones ?? existingZones;

    // Build updated camera object (use building name for Redis)
    const updatedCamera: Camera = {
      ...camera,
      ...updates,
      building: buildingName ?? camera.building,
      motionZones,
      lastUpdated: new Date(),
    } as Camera;

    // Save to Redis (zones as JSON string)
    await cameraRepository.save(externalID, {
      ...updatedCamera,
      motionZones: JSON.stringify(motionZones),
    });

    // Update camera in PostgreSQL
    await db.update(cameraTable)
      .set({
        name: updates.name,
        buildingId: updates.building,
        ipAddress: updates.ipAddress,
        port: updates.port,
        protocol: updates.protocol,
        username: updates.username,
        password: updates.password,
        streamPath: updates.streamPath,
        lastUpdated: new Date(),
      })
      .where(eq(cameraTable.id, externalID));

    // Check if settings were updated - if so, create new settings record
    const settingsUpdated = updates.targetWidth !== undefined ||
      updates.targetHeight !== undefined ||
      updates.motionDetectionEnabled !== undefined ||
      updates.mog2History !== undefined ||
      updates.mog2VarThreshold !== undefined ||
      updates.mog2DetectShadows !== undefined;

    if (settingsUpdated) {
      // Mark old settings as not current
      await db.update(cameraSettingTable)
        .set({ isCurrent: false })
        .where(eq(cameraSettingTable.cameraId, externalID));

      // Create new settings record
      const settingsId = makeID();
      await db.insert(cameraSettingTable).values({
        id: settingsId,
        cameraId: externalID,
        targetWidth: updates.targetWidth ?? updatedCamera.targetWidth ?? null,
        targetHeight: updates.targetHeight ?? updatedCamera.targetHeight ?? null,
        motionDetectionEnabled: updates.motionDetectionEnabled ?? updatedCamera.motionDetectionEnabled,
        mog2History: updates.mog2History ?? updatedCamera.mog2History,
        mog2VarThreshold: updates.mog2VarThreshold ?? updatedCamera.mog2VarThreshold,
        mog2DetectShadows: updates.mog2DetectShadows ?? updatedCamera.mog2DetectShadows,
        isCurrent: true,
        createdAt: new Date(),
      });
    }

    // Update motion zones if provided
    if (updates.motionZones) {
      // Hard delete existing zones
      await db.delete(motionZoneTable)
        .where(eq(motionZoneTable.cameraId, externalID));

      // Insert new zones
      for (const zone of updates.motionZones) {
        await db.insert(motionZoneTable).values({
          id: zone.id,
          cameraId: externalID,
          name: zone.name,
          points: zone.points,
          minContourArea: zone.minContourArea,
          thresholdPercent: zone.thresholdPercent,
          createdAt: new Date(),
          lastUpdated: new Date(),
        });
      }
    }

    // Emit new data to all connected clients
    await emitNewData();

    // Publish camera config change for real-time updates to camera ingestion service
    await publishCameraConfigChange("updated", updatedCamera);

    // Raise event for audit trail
    await raiseEvent({
      type: "info",
      message: `Camera '${externalID}' updated`,
      system: "backend:cameras",
    });

    res.status(200).json({
      success: true,
      camera: {
        ...updatedCamera,
        lastUpdated: updatedCamera.lastUpdated.toISOString(),
      },
    });
  } catch (err) {
    console.error("Error updating camera:", err);
    next(raiseError(500, "Failed to update camera"));
  }
});

/**
 * @route DELETE /:externalID
 * @description Delete a camera by externalID
 * @param {express.Request} req - The request object
 * @param {express.Response} res - The response object
 * @returns {void}
 */
router.delete("/:externalID", async (req, res, next) => {
  const { externalID } = req.params;

  try {
    const cameras = await cameraRepository
      .search()
      .where("externalID")
      .eq(externalID)
      .return.all();

    if (cameras.length === 0) {
      next(raiseError(404, `Camera with externalID '${externalID}' not found`));
      return;
    }

    // Remove camera directly from Redis using the key format: cameras:{externalID}
    const cameraKey = `cameras:${externalID}`;
    const deleted = await redis.del(cameraKey);
    console.log(`[CameraDelete] Deleted key ${cameraKey}: ${deleted} keys removed`);

    // Hard delete in PostgreSQL
    await db.delete(cameraTable)
      .where(eq(cameraTable.id, externalID));

    // Emit new data to all connected clients
    await emitNewData();

    // Publish camera config change for real-time updates to camera ingestion service
    await publishCameraConfigChange("deleted", { externalID });

    // Raise event for audit trail
    await raiseEvent({
      type: "info",
      message: `Camera '${externalID}' deleted`,
      system: "backend:cameras",
    });

    res.status(200).json({
      success: true,
      message: `Camera '${externalID}' deleted successfully`,
    });
  } catch (err) {
    console.error("Error deleting camera:", err);
    next(raiseError(500, "Failed to delete camera"));
  }
});

export default router;/**
 * Create a default full-frame motion zone.
 * Used when creating new cameras with motion detection enabled.
 */

export const createDefaultMotionZone = (): MotionZone => ({
  id: makeID(),
  name: 'Full Frame',
  points: [], // Empty = full frame
  minContourArea: 1500,
  thresholdPercent: 1.0,
});
/**
 * Default MOG2 settings for new cameras.
 */

export const defaultMOG2Settings = {
  mog2History: 500,
  mog2VarThreshold: 16,
  mog2DetectShadows: false,
};

