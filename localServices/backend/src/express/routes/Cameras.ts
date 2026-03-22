import express from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  cameraRepository,
  CameraProtocol,
  Camera,
} from "../../redis/cameras";
import type { DetectionModel } from "../../db/schema/cameraSettings";
import { redis } from "../../redis/index";
import { raiseEvent, raiseError } from "../../events/notify";
import { emitNewData } from "../socketHandler";
import { publishCameraConfigChange } from "../../events/cameraConfigEvents";
import { db } from "../../db/db";
import { cameraTable, cameraSettingTable, motionZoneTable, buildingTable } from "../../db/schema/index";
import { makeID } from "../../utils/index";
import { DEFAULT_MAX_STREAM_FPS, DEFAULT_MAX_RECORDING_FPS } from "../../config";
import {
  DEFAULT_CLASS_CONFIGS,
  classConfigsSchema,
  detectionModelSchema,
  motionZonesSchema,
  parseMotionModelSettings,
  type ClassConfig,
  type MotionZone,
} from "../../db/shared/camera";
import {
  serializeCameraJsonFields,
  type RedisCameraEntity,
  toCameraDto,
  parseStoredClassConfigs,
  parseStoredModelSettings,
  parseStoredMotionZones,
} from "../../cameras/serializers";
import {
  createDefaultMotionZone,
  resolveCreateMotionZones,
  resolveUpdateMotionZones,
} from "../../cameras/motionZones";

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
    building: z.string().min(1, "Building is required"),
    ipAddress: z.string().min(1, "IP address is required"),
    port: z.number().int().min(1).max(65535, "Port must be between 1 and 65535"),
    protocol: z.nativeEnum(CameraProtocol).default(CameraProtocol.UDP),
    username: z.string().optional(),
    password: z.string().optional(),
    streamPath: z.string().optional(),
    expectedSecondsUpdated: z.number().int().min(1).default(30),
    // Target resolution (optional - if not set, uses native resolution from stream)
    targetWidth: z.number().int().min(1).optional(),
    targetHeight: z.number().int().min(1).optional(),
    // Motion detection settings
    motionDetectionEnabled: z.boolean().default(true),
    // Detection model selection (defaults to mog2)
    detectionModel: detectionModelSchema.default("mog2"),
    // Model-specific settings (validated after detectionModel is known)
    modelSettings: z.unknown().optional(),
    // Motion zones (optional - defaults to full frame zone)
    motionZones: motionZonesSchema.optional(),
    // FPS caps (optional - acts as maximum, never upscales)
    maxStreamFps: z.number().int().min(1).max(120).default(DEFAULT_MAX_STREAM_FPS),
    maxRecordingFps: z.number().int().min(1).max(60).default(DEFAULT_MAX_RECORDING_FPS),
    // JPEG encoding quality (1-100, where 100=best quality)
    jpegQuality: z.number().int().min(1).max(100).default(95),
    // Object detection settings (per-camera: enabled flag and class configs only)
    // Model and clip durations are global settings in config.ts
    objectDetectionEnabled: z.boolean().default(false),
    classConfigs: classConfigsSchema.default(DEFAULT_CLASS_CONFIGS),
  });

  const { error, data } = validationSchema.safeParse(req.body);
  if (error) {
    next(raiseError(400, JSON.stringify(error.issues)));
    return;
  }

  try {
    // Generate unique externalID
    const externalID = makeID();

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
    const motionZones: MotionZone[] = resolveCreateMotionZones(data.motionZones);

    // Validate modelSettings matches detectionModel
    const validatedModelSettings = parseMotionModelSettings(
      data.detectionModel,
      data.modelSettings
    );

    // Create camera object for Redis (stores zones as JSON string)
    // Use building.name for Redis (consistent with sensors), buildingId for PostgreSQL
    const camera: Camera = {
      name: data.name,
      externalID,
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
      detectionModel: data.detectionModel,
      modelSettings: validatedModelSettings,
      motionZones,
      maxStreamFps: data.maxStreamFps,
      maxRecordingFps: data.maxRecordingFps,
      jpegQuality: data.jpegQuality,
      // Object detection settings (per-camera only)
      objectDetectionEnabled: data.objectDetectionEnabled,
      classConfigs: data.classConfigs,
    };

    // Save camera to Redis (zones, modelSettings, classConfigs stored as JSON strings via redis-om)
    await cameraRepository.save(externalID, {
      ...camera,
      ...serializeCameraJsonFields({
        modelSettings: validatedModelSettings,
        motionZones,
        classConfigs: data.classConfigs,
      }),
    });

    // Persist camera to PostgreSQL
    await db.insert(cameraTable).values({
      id: externalID,
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
      cameraId: externalID,
      targetWidth: data.targetWidth || null,
      targetHeight: data.targetHeight || null,
      motionDetectionEnabled: data.motionDetectionEnabled,
      detectionModel: data.detectionModel,
      modelSettings: validatedModelSettings,
      maxStreamFps: data.maxStreamFps,
      maxRecordingFps: data.maxRecordingFps,
      jpegQuality: data.jpegQuality,
      // Object detection settings (per-camera only)
      objectDetectionEnabled: data.objectDetectionEnabled,
      classConfigs: data.classConfigs,
      isCurrent: true,
      createdAt: new Date(),
    });

    // Create motion zones in PostgreSQL
    for (const zone of motionZones) {
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

    // Emit new data to all connected clients
    await emitNewData();

    // Publish camera config change for real-time updates to camera ingestion service
    const cameraDto = toCameraDto(camera);
    await publishCameraConfigChange("created", cameraDto);

    // Raise event for audit trail
    await raiseEvent({
      type: "info",
      message: `Camera '${data.name}' (${externalID}) created`,
      system: "backend:cameras",
    });

    res.status(201).json({
      success: true,
      entityId: externalID,
      camera: cameraDto,
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
    const cameras = (await cameraRepository.search().return.all()) as RedisCameraEntity[];
    const serializedCameras = cameras.map((camera) => toCameraDto(camera));

    res.status(200).json({
      success: true,
      count: serializedCameras.length,
      cameras: serializedCameras,
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
    protocol: z.nativeEnum(CameraProtocol).optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    streamPath: z.string().optional(),
    expectedSecondsUpdated: z.number().int().min(1).optional(),
    targetWidth: z.number().int().min(1).optional(),
    targetHeight: z.number().int().min(1).optional(),
    motionDetectionEnabled: z.boolean().optional(),
    // Detection model selection
    detectionModel: detectionModelSchema.optional(),
    // Model-specific settings (validated after detectionModel is known)
    modelSettings: z.unknown().optional(),
    // Motion zones (replaces all zones if provided)
    motionZones: motionZonesSchema.optional(),
    // FPS caps (optional - acts as maximum, never upscales)
    maxStreamFps: z.number().int().min(1).max(120).optional(),
    maxRecordingFps: z.number().int().min(1).max(60).optional(),
    // JPEG encoding quality (1-100, where 100=best quality)
    jpegQuality: z.number().int().min(1).max(100).optional(),
    // Object detection settings (per-camera only)
    objectDetectionEnabled: z.boolean().optional(),
    classConfigs: classConfigsSchema.optional(),
  });

  const { error, data: updates } = validationSchema.safeParse(req.body);
  if (error) {
    next(raiseError(400, JSON.stringify(error.issues)));
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

    const existingZones = parseStoredMotionZones(camera.motionZones);
    const existingClassConfigs = parseStoredClassConfigs(camera.classConfigs);

    // Use updated zones or keep existing
    const motionZones = resolveUpdateMotionZones(existingZones, updates.motionZones);
    const classConfigs = updates.classConfigs ?? existingClassConfigs;

    // Determine detection model and validate settings
    const detectionModel: DetectionModel =
      updates.detectionModel ?? camera.detectionModel ?? "mog2";
    const existingModelSettings = parseStoredModelSettings(
      detectionModel,
      camera.modelSettings
    );
    const modelSettings = updates.modelSettings
      ? parseMotionModelSettings(detectionModel, updates.modelSettings)
      : existingModelSettings;

    // Build updated camera object (use building name for Redis)
    const updatedCamera: Camera = {
      ...camera,
      ...updates,
      building: buildingName ?? camera.building,
      detectionModel,
      modelSettings,
      motionZones,
      classConfigs,
      lastUpdated: new Date(),
    } as Camera;

    // Save to Redis (zones, modelSettings, classConfigs as JSON strings)
    await cameraRepository.save(externalID, {
      ...updatedCamera,
      ...serializeCameraJsonFields({
        modelSettings,
        motionZones,
        classConfigs,
      }),
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
      updates.detectionModel !== undefined ||
      updates.modelSettings !== undefined ||
      updates.maxStreamFps !== undefined ||
      updates.maxRecordingFps !== undefined ||
      updates.jpegQuality !== undefined ||
      updates.objectDetectionEnabled !== undefined ||
      updates.classConfigs !== undefined;

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
        detectionModel: updatedCamera.detectionModel,
        modelSettings: updatedCamera.modelSettings,
        maxStreamFps: updates.maxStreamFps ?? updatedCamera.maxStreamFps ?? DEFAULT_MAX_STREAM_FPS,
        maxRecordingFps: updates.maxRecordingFps ?? updatedCamera.maxRecordingFps ?? DEFAULT_MAX_RECORDING_FPS,
        jpegQuality: updates.jpegQuality ?? updatedCamera.jpegQuality ?? 95,
        // Object detection settings (per-camera only)
        objectDetectionEnabled: updates.objectDetectionEnabled ?? updatedCamera.objectDetectionEnabled,
        classConfigs: updates.classConfigs ?? updatedCamera.classConfigs,
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
    const updatedCameraDto = toCameraDto(updatedCamera);
    await publishCameraConfigChange("updated", updatedCameraDto);

    // Raise event for audit trail
    await raiseEvent({
      type: "info",
      message: `Camera '${externalID}' updated`,
      system: "backend:cameras",
    });

    res.status(200).json({
      success: true,
      camera: updatedCameraDto,
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

export default router;
