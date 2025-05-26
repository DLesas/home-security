import { Router, Request, Response, NextFunction } from "express";
import { desc, asc, eq, and, gte, lte, like, count } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/db";
import {
  errorLogTable,
  eventLogTable,
  generalLogTable,
  sensorLogTable,
  alarmLogTable,
  sensorUpdateTable,
  doorSensorTable,
  alarmTable,
} from "../../db/schema/index";
import { raiseError } from "src/events/notify";

const router = Router();

/**
 * Base query schema for common pagination and filtering parameters
 */
const baseQuerySchema = z.object({
  /** Page number (1-based, default: 1) */
  page: z
    .string()
    .optional()
    .transform((val) => Math.max(1, parseInt(val || "1", 10))),
  /** Number of items per page (max 100, default: 50) */
  limit: z
    .string()
    .optional()
    .transform((val) => Math.min(100, Math.max(1, parseInt(val || "50", 10)))),
  /** Sort order: 'asc' or 'desc' (default: 'desc') */
  sort: z.enum(["asc", "desc"]).optional().default("desc"),
  /** Start date filter (ISO string) */
  startDate: z.string().datetime().optional(),
  /** End date filter (ISO string) */
  endDate: z.string().datetime().optional(),
});

/**
 * Error logs query schema
 */
const errorLogsQuerySchema = baseQuerySchema.extend({
  /** Filter by log level */
  level: z.enum(["info", "warning", "critical"]).optional(),
});

/**
 * Event logs query schema
 */
const eventLogsQuerySchema = baseQuerySchema.extend({
  /** Filter by event type */
  type: z.enum(["info", "warning", "critical"]).optional(),
  /** Filter by system (partial match) */
  system: z.string().min(1).optional(),
});

/**
 * Access logs query schema
 */
const accessLogsQuerySchema = baseQuerySchema.extend({
  /** Filter by HTTP action */
  action: z.enum(["GET", "POST", "PUT", "DELETE"]).optional(),
  /** Filter by connection type */
  connection: z.enum(["http", "socket"]).optional(),
  /** Filter by client IP (partial match) */
  clientIp: z.string().ip().optional(),
});

/**
 * Sensor logs query schema
 */
const sensorLogsQuerySchema = baseQuerySchema.extend({
  /** Filter by sensor name */
  sensorName: z.string().min(1).optional(),
  /** Filter by log type */
  type: z.string().min(1).optional(),
});

/**
 * Alarm logs query schema
 */
const alarmLogsQuerySchema = baseQuerySchema.extend({
  /** Filter by alarm name */
  alarmName: z.string().min(1).optional(),
  /** Filter by log type */
  type: z.string().min(1).optional(),
});

/**
 * Sensor updates query schema
 */
const sensorUpdatesQuerySchema = baseQuerySchema.extend({
  /** Filter by sensor name */
  sensorName: z.string().min(1).optional(),
  /** Filter by sensor state */
  state: z.enum(["open", "closed", "unknown"]).optional(),
  /** Minimum temperature filter */
  minTemperature: z
    .string()
    .transform((val) => parseFloat(val))
    .optional(),
  /** Maximum temperature filter */
  maxTemperature: z
    .string()
    .transform((val) => parseFloat(val))
    .optional(),
  /** Minimum voltage filter */
  minVoltage: z
    .string()
    .transform((val) => parseFloat(val))
    .optional(),
  /** Maximum voltage filter */
  maxVoltage: z
    .string()
    .transform((val) => parseFloat(val))
    .optional(),
});

/**
 * Middleware to validate query parameters using Zod schema
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
function validateQuery<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: Function) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const err = raiseError(
          400,
          `Invalid query parameters: ${error.errors
            .map((err) => ({
              field: err.path.join("."),
              message: err.message,
              code: err.code,
            }))
            .join(", ")}`
        );
        next(err);
      } else {
        const err = raiseError(400, `Invalid query parameters: ${error}`);
        next(err);
      }
    }
  };
}

/**
 * Processed query result with proper typing
 */
type ProcessedQuery = {
  page: number;
  limit: number;
  sort: typeof asc | typeof desc;
  offset: number;
  dateFilters: {
    startDate?: Date;
    endDate?: Date;
  };
  otherFilters: any; // Using 'any' for practical type safety - validated by Zod middleware
};

/**
 * Type-safe query processor that works with validated Zod schemas
 *
 * This function provides runtime type safety through Zod validation middleware.
 * While we use 'any' for TypeScript compatibility with Express, the actual
 * runtime types are guaranteed to be correct by the validation middleware.
 *
 * @param query - Validated query object (guaranteed to match schema after middleware)
 * @returns Processed parameters for database queries
 */
function processValidatedQuery(query: any): ProcessedQuery {
  const { page, limit, sort, startDate, endDate, ...filters } = query;

  const offset = (page - 1) * limit;
  const sortFn = sort === "asc" ? asc : desc;

  const dateFilters: { startDate?: Date; endDate?: Date } = {};
  if (startDate) dateFilters.startDate = new Date(startDate);
  if (endDate) dateFilters.endDate = new Date(endDate);

  return {
    page,
    limit,
    sort: sortFn,
    offset,
    dateFilters,
    otherFilters: filters,
  };
}

/**
 * GET /api/v1/logs/errors
 * Retrieves error logs with filtering and pagination
 *
 * @route GET /api/v1/logs/errors
 * @param {z.infer<typeof errorLogsQuerySchema>} query - Validated query parameters
 * @returns {LogResponse} Paginated error logs
 *
 * @example
 * GET /api/v1/logs/errors?page=1&limit=20&sort=desc&startDate=2024-01-01T00:00:00Z&level=critical
 */
router.get(
  "/errors",
  validateQuery(errorLogsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sort, offset, dateFilters, otherFilters } =
        processValidatedQuery(req.query);

      // Build where conditions
      const whereConditions = [];

      if (dateFilters.startDate) {
        whereConditions.push(
          gte(errorLogTable.dateTime, dateFilters.startDate)
        );
      }

      if (dateFilters.endDate) {
        whereConditions.push(lte(errorLogTable.dateTime, dateFilters.endDate));
      }

      if (otherFilters.level) {
        whereConditions.push(eq(errorLogTable.level, otherFilters.level));
      }

      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(errorLogTable)
        .where(
          whereConditions.length > 0 ? and(...whereConditions) : undefined
        );

      // Get paginated data
      const data = await db
        .select()
        .from(errorLogTable)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(sort(errorLogTable.dateTime))
        .limit(limit)
        .offset(offset);

      const totalPages = Math.ceil(totalResult.count / limit);

      res.json({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total: totalResult.count,
          totalPages,
        },
        filters: {
          startDate: dateFilters.startDate?.toISOString(),
          endDate: dateFilters.endDate?.toISOString(),
          ...otherFilters,
        },
      });
    } catch (error) {
      console.error("Error fetching error logs:", error);
      const err = raiseError(500, `Error fetching error logs: ${error}`);
      next(err);
    }
  }
);

/**
 * GET /api/v1/logs/events
 * Retrieves event logs with filtering and pagination
 *
 * @route GET /api/v1/logs/events
 * @param {z.infer<typeof eventLogsQuerySchema>} query - Validated query parameters
 * @returns {LogResponse} Paginated event logs
 *
 * @example
 * GET /api/v1/logs/events?type=critical&system=backend&page=1&limit=25
 */
router.get(
  "/events",
  validateQuery(eventLogsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sort, offset, dateFilters, otherFilters } =
        processValidatedQuery(req.query);

      // Build where conditions
      const whereConditions = [];

      if (dateFilters.startDate) {
        whereConditions.push(
          gte(eventLogTable.dateTime, dateFilters.startDate)
        );
      }

      if (dateFilters.endDate) {
        whereConditions.push(lte(eventLogTable.dateTime, dateFilters.endDate));
      }

      if (otherFilters.type) {
        whereConditions.push(eq(eventLogTable.type, otherFilters.type));
      }

      if (otherFilters.system) {
        whereConditions.push(
          like(eventLogTable.system, `%${otherFilters.system}%`)
        );
      }

      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(eventLogTable)
        .where(
          whereConditions.length > 0 ? and(...whereConditions) : undefined
        );

      // Get paginated data
      const data = await db
        .select()
        .from(eventLogTable)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(sort(eventLogTable.dateTime))
        .limit(limit)
        .offset(offset);

      const totalPages = Math.ceil(totalResult.count / limit);

      res.json({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total: totalResult.count,
          totalPages,
        },
        filters: {
          startDate: dateFilters.startDate?.toISOString(),
          endDate: dateFilters.endDate?.toISOString(),
          ...otherFilters,
        },
      });
    } catch (error) {
      console.error("Error fetching event logs:", error);
      const err = raiseError(500, `Error fetching event logs: ${error}`);
      next(err);
    }
  }
);

/**
 * GET /api/v1/logs/access
 * Retrieves access logs with filtering and pagination
 *
 * @route GET /api/v1/logs/access
 * @param {z.infer<typeof accessLogsQuerySchema>} query - Validated query parameters
 * @returns {LogResponse} Paginated access logs
 *
 * @example
 * GET /api/v1/logs/access?action=POST&clientIp=192.168.1.100&page=1
 */
router.get(
  "/access",
  validateQuery(accessLogsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sort, offset, dateFilters, otherFilters } =
        processValidatedQuery(req.query);

      // Build where conditions
      const whereConditions = [];

      if (dateFilters.startDate) {
        whereConditions.push(
          gte(generalLogTable.dateTime, dateFilters.startDate)
        );
      }

      if (dateFilters.endDate) {
        whereConditions.push(
          lte(generalLogTable.dateTime, dateFilters.endDate)
        );
      }

      if (otherFilters.action) {
        whereConditions.push(eq(generalLogTable.action, otherFilters.action));
      }

      if (otherFilters.connection) {
        whereConditions.push(
          eq(generalLogTable.connection, otherFilters.connection)
        );
      }

      if (otherFilters.clientIp) {
        whereConditions.push(
          like(generalLogTable.clientIp, `%${otherFilters.clientIp}%`)
        );
      }

      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(generalLogTable)
        .where(
          whereConditions.length > 0 ? and(...whereConditions) : undefined
        );

      // Get paginated data
      const data = await db
        .select()
        .from(generalLogTable)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(sort(generalLogTable.dateTime))
        .limit(limit)
        .offset(offset);

      const totalPages = Math.ceil(totalResult.count / limit);

      res.json({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total: totalResult.count,
          totalPages,
        },
        filters: {
          startDate: dateFilters.startDate?.toISOString(),
          endDate: dateFilters.endDate?.toISOString(),
          ...otherFilters,
        },
      });
    } catch (error) {
      console.error("Error fetching access logs:", error);
      const err = raiseError(500, `Error fetching access logs: ${error}`);
      next(err);
    }
  }
);

/**
 * GET /api/v1/logs/sensors
 * Retrieves sensor logs with filtering and pagination
 *
 * @route GET /api/v1/logs/sensors
 * @param {z.infer<typeof sensorLogsQuerySchema>} query - Validated query parameters
 * @returns {LogResponse} Paginated sensor logs
 *
 * @example
 * GET /api/v1/logs/sensors?sensorId=sensor-001&type=error&page=1
 */
router.get(
  "/sensors",
  validateQuery(sensorLogsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sort, offset, dateFilters, otherFilters } =
        processValidatedQuery(req.query);

      // Build where conditions
      const whereConditions = [];

      if (dateFilters.startDate) {
        whereConditions.push(
          gte(sensorLogTable.dateTime, dateFilters.startDate)
        );
      }

      if (dateFilters.endDate) {
        whereConditions.push(lte(sensorLogTable.dateTime, dateFilters.endDate));
      }

      if (otherFilters.sensorName) {
        whereConditions.push(eq(doorSensorTable.name, otherFilters.sensorName));
      }

      if (otherFilters.type) {
        whereConditions.push(eq(sensorLogTable.type, otherFilters.type));
      }

      // Get total count with join
      const [totalResult] = await db
        .select({ count: count() })
        .from(sensorLogTable)
        .leftJoin(
          doorSensorTable,
          eq(sensorLogTable.sensorId, doorSensorTable.id)
        )
        .where(
          whereConditions.length > 0 ? and(...whereConditions) : undefined
        );

      // Get paginated data with join
      const data = await db
        .select({
          id: sensorLogTable.id,
          sensorId: sensorLogTable.sensorId,
          sensorName: doorSensorTable.name,
          dateTime: sensorLogTable.dateTime,
          class: sensorLogTable.class,
          function: sensorLogTable.function,
          errorMessage: sensorLogTable.errorMessage,
          hash: sensorLogTable.hash,
          type: sensorLogTable.type,
          count: sensorLogTable.count,
        })
        .from(sensorLogTable)
        .leftJoin(
          doorSensorTable,
          eq(sensorLogTable.sensorId, doorSensorTable.id)
        )
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(sort(sensorLogTable.dateTime))
        .limit(limit)
        .offset(offset);

      const totalPages = Math.ceil(totalResult.count / limit);

      res.json({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total: totalResult.count,
          totalPages,
        },
        filters: {
          startDate: dateFilters.startDate?.toISOString(),
          endDate: dateFilters.endDate?.toISOString(),
          ...otherFilters,
        },
      });
    } catch (error) {
      console.error("Error fetching sensor logs:", error);
      const err = raiseError(500, `Error fetching sensor logs: ${error}`);
      next(err);
    }
  }
);

/**
 * GET /api/v1/logs/alarms
 * Retrieves alarm logs with filtering and pagination
 *
 * @route GET /api/v1/logs/alarms
 * @param {z.infer<typeof alarmLogsQuerySchema>} query - Validated query parameters
 * @returns {LogResponse} Paginated alarm logs
 *
 * @example
 * GET /api/v1/logs/alarms?alarmId=alarm-001&type=error&page=1
 */
router.get(
  "/alarms",
  validateQuery(alarmLogsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sort, offset, dateFilters, otherFilters } =
        processValidatedQuery(req.query);

      // Build where conditions
      const whereConditions = [];

      if (dateFilters.startDate) {
        whereConditions.push(
          gte(alarmLogTable.dateTime, dateFilters.startDate)
        );
      }

      if (dateFilters.endDate) {
        whereConditions.push(lte(alarmLogTable.dateTime, dateFilters.endDate));
      }

      if (otherFilters.alarmName) {
        whereConditions.push(eq(alarmTable.name, otherFilters.alarmName));
      }

      if (otherFilters.type) {
        whereConditions.push(eq(alarmLogTable.type, otherFilters.type));
      }

      // Get total count with join
      const [totalResult] = await db
        .select({ count: count() })
        .from(alarmLogTable)
        .leftJoin(alarmTable, eq(alarmLogTable.alarmId, alarmTable.id))
        .where(
          whereConditions.length > 0 ? and(...whereConditions) : undefined
        );

      // Get paginated data with join
      const data = await db
        .select({
          id: alarmLogTable.id,
          alarmId: alarmLogTable.alarmId,
          alarmName: alarmTable.name,
          dateTime: alarmLogTable.dateTime,
          class: alarmLogTable.class,
          function: alarmLogTable.function,
          errorMessage: alarmLogTable.errorMessage,
          hash: alarmLogTable.hash,
          type: alarmLogTable.type,
          count: alarmLogTable.count,
        })
        .from(alarmLogTable)
        .leftJoin(alarmTable, eq(alarmLogTable.alarmId, alarmTable.id))
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(sort(alarmLogTable.dateTime))
        .limit(limit)
        .offset(offset);

      const totalPages = Math.ceil(totalResult.count / limit);

      res.json({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total: totalResult.count,
          totalPages,
        },
        filters: {
          startDate: dateFilters.startDate?.toISOString(),
          endDate: dateFilters.endDate?.toISOString(),
          ...otherFilters,
        },
      });
    } catch (error) {
      console.error("Error fetching alarm logs:", error);
      const err = raiseError(500, `Error fetching alarm logs: ${error}`);
      next(err);
    }
  }
);

/**
 * GET /api/v1/logs/sensor-updates
 * Retrieves sensor updates with filtering and pagination
 *
 * @route GET /api/v1/logs/sensor-updates
 * @param {z.infer<typeof sensorUpdatesQuerySchema>} query - Validated query parameters
 * @returns {LogResponse} Paginated sensor updates
 *
 * @example
 * GET /api/v1/logs/sensor-updates?sensorId=sensor-001&state=open&minTemperature=20&page=1
 */
router.get(
  "/sensor-updates",
  validateQuery(sensorUpdatesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sort, offset, dateFilters, otherFilters } =
        processValidatedQuery(req.query);

      // Build where conditions
      const whereConditions = [];

      if (dateFilters.startDate) {
        whereConditions.push(
          gte(sensorUpdateTable.dateTime, dateFilters.startDate)
        );
      }

      if (dateFilters.endDate) {
        whereConditions.push(
          lte(sensorUpdateTable.dateTime, dateFilters.endDate)
        );
      }

      if (otherFilters.sensorName) {
        whereConditions.push(eq(doorSensorTable.name, otherFilters.sensorName));
      }

      if (otherFilters.state) {
        whereConditions.push(eq(sensorUpdateTable.state, otherFilters.state));
      }

      if (otherFilters.minTemperature !== undefined) {
        whereConditions.push(
          gte(
            sensorUpdateTable.temperature,
            otherFilters.minTemperature.toString()
          )
        );
      }

      if (otherFilters.maxTemperature !== undefined) {
        whereConditions.push(
          lte(
            sensorUpdateTable.temperature,
            otherFilters.maxTemperature.toString()
          )
        );
      }

      if (otherFilters.minVoltage !== undefined) {
        whereConditions.push(
          gte(sensorUpdateTable.voltage, otherFilters.minVoltage.toString())
        );
      }

      if (otherFilters.maxVoltage !== undefined) {
        whereConditions.push(
          lte(sensorUpdateTable.voltage, otherFilters.maxVoltage.toString())
        );
      }

      // Get total count with join
      const [totalResult] = await db
        .select({ count: count() })
        .from(sensorUpdateTable)
        .leftJoin(
          doorSensorTable,
          eq(sensorUpdateTable.sensorId, doorSensorTable.id)
        )
        .where(
          whereConditions.length > 0 ? and(...whereConditions) : undefined
        );

      // Get paginated data with join
      const data = await db
        .select({
          id: sensorUpdateTable.id,
          sensorId: sensorUpdateTable.sensorId,
          sensorName: doorSensorTable.name,
          state: sensorUpdateTable.state,
          temperature: sensorUpdateTable.temperature,
          voltage: sensorUpdateTable.voltage,
          frequency: sensorUpdateTable.frequency,
          dateTime: sensorUpdateTable.dateTime,
        })
        .from(sensorUpdateTable)
        .leftJoin(
          doorSensorTable,
          eq(sensorUpdateTable.sensorId, doorSensorTable.id)
        )
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(sort(sensorUpdateTable.dateTime))
        .limit(limit)
        .offset(offset);

      const totalPages = Math.ceil(totalResult.count / limit);

      res.json({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total: totalResult.count,
          totalPages,
        },
        filters: {
          startDate: dateFilters.startDate?.toISOString(),
          endDate: dateFilters.endDate?.toISOString(),
          ...otherFilters,
        },
      });
    } catch (error) {
      console.error("Error fetching sensor updates:", error);
      const err = raiseError(500, `Error fetching sensor updates: ${error}`);
      next(err);
    }
  }
);

/**
 * GET /api/v1/logs/summary
 * Retrieves a summary of log counts by type and recent activity
 *
 * @route GET /api/v1/logs/summary
 * @returns {Object} Log summary statistics
 *
 * @example
 * GET /api/v1/logs/summary
 */
router.get(
  "/summary",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get counts for different log types
      const [errorCount] = await db
        .select({ count: count() })
        .from(errorLogTable);
      const [eventCount] = await db
        .select({ count: count() })
        .from(eventLogTable);
      const [accessCount] = await db
        .select({ count: count() })
        .from(generalLogTable);
      const [sensorCount] = await db
        .select({ count: count() })
        .from(sensorLogTable);
      const [alarmCount] = await db
        .select({ count: count() })
        .from(alarmLogTable);
      const [sensorUpdateCount] = await db
        .select({ count: count() })
        .from(sensorUpdateTable);

      // Get recent activity (last 24 hours)
      const [recentErrors] = await db
        .select({ count: count() })
        .from(errorLogTable)
        .where(gte(errorLogTable.dateTime, last24Hours));

      const [recentEvents] = await db
        .select({ count: count() })
        .from(eventLogTable)
        .where(gte(eventLogTable.dateTime, last24Hours));

      const [recentSensorUpdates] = await db
        .select({ count: count() })
        .from(sensorUpdateTable)
        .where(gte(sensorUpdateTable.dateTime, last24Hours));

      // Get critical events from last week
      const criticalEvents = await db
        .select()
        .from(eventLogTable)
        .where(
          and(
            eq(eventLogTable.type, "critical"),
            gte(eventLogTable.dateTime, lastWeek)
          )
        )
        .orderBy(desc(eventLogTable.dateTime))
        .limit(10);

      res.json({
        success: true,
        summary: {
          totalCounts: {
            errors: errorCount.count,
            events: eventCount.count,
            access: accessCount.count,
            sensors: sensorCount.count,
            alarms: alarmCount.count,
            sensorUpdates: sensorUpdateCount.count,
          },
          recentActivity: {
            errorsLast24h: recentErrors.count,
            eventsLast24h: recentEvents.count,
            sensorUpdatesLast24h: recentSensorUpdates.count,
          },
          criticalEventsLastWeek: criticalEvents,
        },
      });
    } catch (error) {
      console.error("Error fetching log summary:", error);
      const err = raiseError(500, `Error fetching log summary: ${error}`);
      next(err);
    }
  }
);

export default router;
