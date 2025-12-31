import express from "express";
import { z } from "zod";
import { eq, desc, and, gte, lte, inArray, sql } from "drizzle-orm";
import { db } from "../../db/db";
import { detectionsTable } from "../../db/schema/detections";
import { detectionBoxesTable } from "../../db/schema/detectionBoxes";
import { cameraRepository } from "../../redis/cameras";
import { raiseError } from "../../events/notify";

const router = express.Router();

// ============================================================================
// Zod Schemas
// ============================================================================

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const detectionQuerySchema = paginationSchema.merge(dateRangeSchema).extend({
  cameraId: z.string().optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch boxes for a list of detections in a single query.
 */
async function fetchBoxesForDetections(detectionIds: string[]) {
  if (detectionIds.length === 0) return {};

  const boxes = await db
    .select()
    .from(detectionBoxesTable)
    .where(inArray(detectionBoxesTable.detectionId, detectionIds));

  // Group boxes by detectionId
  return boxes.reduce((acc, box) => {
    if (!acc[box.detectionId]) acc[box.detectionId] = [];
    acc[box.detectionId].push(box);
    return acc;
  }, {} as Record<string, typeof boxes>);
}

/**
 * Build date range conditions for detection queries.
 */
function buildDateConditions(startDate?: string, endDate?: string) {
  const conditions = [];

  if (startDate) {
    conditions.push(gte(detectionsTable.timestamp, new Date(startDate)));
  }

  if (endDate) {
    conditions.push(lte(detectionsTable.timestamp, new Date(endDate)));
  }

  return conditions;
}

/**
 * Verify camera exists by externalID. Returns camera or null.
 */
async function verifyCamera(cameraId: string) {
  const cameras = await cameraRepository
    .search()
    .where("externalID")
    .eq(cameraId)
    .return.all();

  return cameras.length > 0 ? cameras[0] : null;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * @route GET /
 * @description Get all detections with optional filtering
 */
router.get("/", async (req, res, next) => {
  const parsed = detectionQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(raiseError(400, `Invalid query: ${parsed.error.message}`));
    return;
  }

  const { cameraId, startDate, endDate, limit, offset } = parsed.data;

  try {
    const conditions = buildDateConditions(startDate, endDate);

    if (cameraId) {
      conditions.push(eq(detectionsTable.cameraId, cameraId));
    }

    const detections = await db
      .select()
      .from(detectionsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(detectionsTable.timestamp))
      .limit(limit)
      .offset(offset);

    const boxesMap = await fetchBoxesForDetections(detections.map((d) => d.id));

    res.status(200).json(
      detections.map((detection) => ({
        ...detection,
        boxes: boxesMap[detection.id] || [],
      }))
    );
  } catch (err) {
    console.error("Error fetching detections:", err);
    next(raiseError(500, "Failed to fetch detections"));
  }
});

/**
 * @route GET /camera/:cameraId
 * @description Get detections for a specific camera
 */
router.get("/camera/:cameraId", async (req, res, next) => {
  const { cameraId } = req.params;
  const parsed = paginationSchema.merge(dateRangeSchema).safeParse(req.query);

  if (!parsed.success) {
    next(raiseError(400, `Invalid query: ${parsed.error.message}`));
    return;
  }

  const { startDate, endDate, limit, offset } = parsed.data;

  try {
    // Verify camera exists
    const camera = await verifyCamera(cameraId);
    if (!camera) {
      next(raiseError(404, `Camera '${cameraId}' not found`));
      return;
    }

    const conditions = [
      eq(detectionsTable.cameraId, cameraId),
      ...buildDateConditions(startDate, endDate),
    ];

    const detections = await db
      .select()
      .from(detectionsTable)
      .where(and(...conditions))
      .orderBy(desc(detectionsTable.timestamp))
      .limit(limit)
      .offset(offset);

    const boxesMap = await fetchBoxesForDetections(detections.map((d) => d.id));

    res.status(200).json(
      detections.map((detection) => ({
        ...detection,
        boxes: boxesMap[detection.id] || [],
      }))
    );
  } catch (err) {
    console.error("Error fetching camera detections:", err);
    next(raiseError(500, "Failed to fetch camera detections"));
  }
});

/**
 * @route GET /stats/camera/:cameraId
 * @description Get detection statistics for a camera
 */
router.get("/stats/camera/:cameraId", async (req, res, next) => {
  const { cameraId } = req.params;
  const parsed = dateRangeSchema.safeParse(req.query);

  if (!parsed.success) {
    next(raiseError(400, `Invalid query: ${parsed.error.message}`));
    return;
  }

  const { startDate, endDate } = parsed.data;

  try {
    // Verify camera exists
    const camera = await verifyCamera(cameraId);
    if (!camera) {
      next(raiseError(404, `Camera '${cameraId}' not found`));
      return;
    }

    const conditions = [
      eq(detectionsTable.cameraId, cameraId),
      ...buildDateConditions(startDate, endDate),
    ];

    // Detection count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(detectionsTable)
      .where(and(...conditions));

    // Class distribution
    const classDistribution = await db
      .select({
        className: detectionBoxesTable.className,
        count: sql<number>`count(*)`,
      })
      .from(detectionBoxesTable)
      .innerJoin(detectionsTable, eq(detectionBoxesTable.detectionId, detectionsTable.id))
      .where(and(...conditions))
      .groupBy(detectionBoxesTable.className);

    res.status(200).json({
      cameraId,
      totalDetections: Number(countResult[0]?.count || 0),
      classDistribution: classDistribution.reduce(
        (acc, item) => {
          acc[item.className] = Number(item.count);
          return acc;
        },
        {} as Record<string, number>
      ),
    });
  } catch (err) {
    console.error("Error fetching detection stats:", err);
    next(raiseError(500, "Failed to fetch detection stats"));
  }
});

export default router;
