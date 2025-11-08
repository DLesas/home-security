import {
  recurringScheduleRepository,
  oneTimeScheduleRepository,
  type RecurringSchedule,
  type OneTimeSchedule,
} from "./redis/schedules";
import { doorSensorRepository, type doorSensor } from "./redis/doorSensors";
import { raiseEvent } from "./events/notify";
import { emitNewData } from "./express/socketHandler";
import { db } from "./db/db";
import { scheduleExecutionTable } from "./db/schema/index";

// Type for the callback function that handles sensor status changes
type SensorStateChangeCallback = (
  sensors: doorSensor[],
  armed: boolean
) => Promise<Boolean[]>;

// Interface for scheduled actions (arm or disarm)
interface ScheduledAction {
  scheduleId: string;
  scheduleName: string;
  scheduleType: "recurring" | "oneTime";
  timeoutId: NodeJS.Timeout;
  scheduledTime: Date;
}

// Interface for retry context - per sensor retry tracking
interface RetryContext {
  scheduleId: string;
  scheduleName: string;
  sensorId: string;
  sensorName: string;
  sensorBuilding: string;
  armTime: Date; // When arming was attempted
  disarmTime: Date; // Hard cutoff - always present
  retryCount: number;
  retryTimeoutId?: NodeJS.Timeout;
  warningEmitted: boolean;
}

// Hardcoded retry interval in seconds
const RETRY_INTERVAL_SECONDS = 60;

/**
 * Singleton class for managing unified schedule execution with timeout-based execution.
 *
 * This class handles:
 * - Unified schedules containing BOTH arm and disarm configurations
 * - Timeout-based execution (not polling) for precise timing
 * - Smart arming with retry logic when sensors are open
 * - Automatic cleanup of expired one-time schedules
 * - Reset mechanism for when schedules are added/modified/deleted
 *
 * Key Design:
 * - Every schedule has BOTH armTime and disarmTime (or armDateTime/disarmDateTime)
 * - Arm and disarm timeouts are stored separately but linked by scheduleId
 * - After execution, only the executed action is rescheduled (for recurring)
 * - resetSchedules() clears all and recalculates when schedules change
 *
 * @example
 * ```typescript
 * import { scheduleManager } from './scheduleManager';
 * import { changeSensorStatus } from './sensorFuncs';
 *
 * scheduleManager.setSensorStateChangeCallback(changeSensorStatus);
 * await scheduleManager.start();
 *
 * // After adding/modifying/deleting schedules:
 * await scheduleManager.resetSchedules();
 * ```
 */
export class ScheduleManager {
  /** Map of scheduleId to arm timeout info */
  private armTimeouts = new Map<string, ScheduledAction>();

  /** Map of scheduleId to disarm timeout info */
  private disarmTimeouts = new Map<string, ScheduledAction>();

  /** Map of sensor IDs to their retry contexts (sensor-specific retries) */
  private retryQueues = new Map<string, RetryContext>();

  /** Flag indicating whether the manager is running */
  private isRunningFlag = false;

  /** Callback function to handle sensor state changes */
  private sensorStateChangeCallback?: SensorStateChangeCallback;

  /** Timer for daily schedule check at midnight */
  private dailyCheckTimer?: NodeJS.Timeout;

  constructor() {
    // No initialization needed - manager starts in stopped state
  }

  /**
   * Set the callback function for handling sensor state changes.
   * This must be called before start() to enable schedule execution.
   */
  setSensorStateChangeCallback(callback: SensorStateChangeCallback): void {
    this.sensorStateChangeCallback = callback;
  }

  /**
   * Start the schedule management service.
   */
  async start(): Promise<void> {
    if (this.isRunningFlag) {
      console.warn("ScheduleManager is already running");
      return;
    }

    if (!this.sensorStateChangeCallback) {
      throw new Error(
        "Sensor state change callback must be set before starting"
      );
    }

    console.log("Starting schedule management...");
    this.isRunningFlag = true;

    // Load all active schedules
    await this.loadSchedules();

    // Set up daily check at midnight for day transitions and cleanup
    this.setupDailyCheck();

    console.log("ScheduleManager started successfully");
  }

  /**
   * Stop the schedule management service.
   */
  stop(): void {
    if (!this.isRunningFlag) {
      console.warn("ScheduleManager is not running");
      return;
    }

    console.log("Stopping schedule management...");

    this.clearAllTimeouts();

    this.isRunningFlag = false;
    console.log("ScheduleManager stopped");
  }

  /**
   * Clear all timeouts (arm, disarm, retry, daily check).
   */
  private clearAllTimeouts(): void {
    // Clear all arm timeouts
    this.armTimeouts.forEach((action, scheduleId) => {
      clearTimeout(action.timeoutId);
      console.log(
        `[SCHEDULE] Cleared arm timeout for schedule ${scheduleId}`
      );
    });
    this.armTimeouts.clear();

    // Clear all disarm timeouts
    this.disarmTimeouts.forEach((action, scheduleId) => {
      clearTimeout(action.timeoutId);
      console.log(
        `[SCHEDULE] Cleared disarm timeout for schedule ${scheduleId}`
      );
    });
    this.disarmTimeouts.clear();

    // Clear all retry timeouts
    this.retryQueues.forEach((context, sensorId) => {
      if (context.retryTimeoutId) {
        clearTimeout(context.retryTimeoutId);
      }
      console.log(`[SCHEDULE] Cleared retry queue for sensor ${sensorId}`);
    });
    this.retryQueues.clear();

    // Clear daily check timer
    if (this.dailyCheckTimer) {
      clearTimeout(this.dailyCheckTimer);
      this.dailyCheckTimer = undefined;
    }
  }

  /**
   * Reset schedules - clear all timeouts and reload from Redis.
   * Called from API routes when schedules are added/modified/deleted.
   */
  async resetSchedules(): Promise<void> {
    console.log("[SCHEDULE] Resetting all schedules...");
    this.clearAllTimeouts();
    await this.loadSchedules();
    console.log("[SCHEDULE] All schedules reset successfully");
  }

  /**
   * Load all schedules from Redis and set up their execution timeouts.
   */
  async loadSchedules(): Promise<void> {
    console.log("[SCHEDULE] Loading all schedules...");

    // Load recurring schedules
    const recurringSchedules = (await recurringScheduleRepository
      .search()
      .returnAll()) as RecurringSchedule[];

    for (const schedule of recurringSchedules) {
      if (schedule.active) {
        await this.setupRecurringSchedule(schedule);
      }
    }

    // Load one-time schedules
    const oneTimeSchedules = (await oneTimeScheduleRepository
      .search()
      .returnAll()) as OneTimeSchedule[];

    for (const schedule of oneTimeSchedules) {
      await this.setupOneTimeSchedule(schedule);
    }

    console.log(
      `[SCHEDULE] Loaded ${recurringSchedules.filter(s => s.active).length} active recurring and ${oneTimeSchedules.length} one-time schedules`
    );
  }

  /**
   * Set up execution for a recurring schedule.
   * Sets up BOTH arm and disarm timeouts simultaneously.
   */
  private async setupRecurringSchedule(
    schedule: RecurringSchedule
  ): Promise<void> {
    const scheduleId = schedule.id;

    if (!scheduleId) {
      console.error("[SCHEDULE] Recurring schedule missing ID:", schedule);
      return;
    }

    // Calculate next arm time
    const nextArmTime = this.calculateNextArmTime(schedule);
    if (nextArmTime) {
      this.scheduleArmTimeout(scheduleId, schedule.name, "recurring", nextArmTime);
    }

    // Calculate next disarm time
    const nextDisarmTime = this.calculateNextDisarmTime(schedule);
    if (nextDisarmTime) {
      this.scheduleDisarmTimeout(scheduleId, schedule.name, "recurring", nextDisarmTime);
    }

    console.log(
      `[SCHEDULE] Set up recurring schedule "${schedule.name}" - ` +
      `Arm: ${nextArmTime?.toLocaleString() || 'N/A'}, Disarm: ${nextDisarmTime?.toLocaleString() || 'N/A'}`
    );
  }

  /**
   * Set up execution for a one-time schedule.
   * Sets up BOTH arm and disarm timeouts, auto-removes after disarm executes.
   */
  private async setupOneTimeSchedule(
    schedule: OneTimeSchedule
  ): Promise<void> {
    const scheduleId = schedule.id;

    if (!scheduleId) {
      console.error("[SCHEDULE] One-time schedule missing ID:", schedule);
      return;
    }

    const now = new Date();
    const armTime = new Date(schedule.armDateTime);
    const disarmTime = new Date(schedule.disarmDateTime);

    // Check if both times are in the past - remove schedule
    if (disarmTime < now) {
      console.log(
        `[SCHEDULE] One-time schedule "${schedule.name}" has expired, removing`
      );
      await this.removeExpiredOneTimeSchedule(scheduleId);
      return;
    }

    // Set up arm timeout if in the future
    if (armTime > now) {
      this.scheduleArmTimeout(scheduleId, schedule.name, "oneTime", armTime);
    } else {
      console.log(
        `[SCHEDULE] One-time schedule "${schedule.name}" arm time already passed`
      );
    }

    // Set up disarm timeout if in the future
    if (disarmTime > now) {
      this.scheduleDisarmTimeout(scheduleId, schedule.name, "oneTime", disarmTime);
    }

    console.log(
      `[SCHEDULE] Set up one-time schedule "${schedule.name}" - ` +
      `Arm: ${armTime.toLocaleString()}, Disarm: ${disarmTime.toLocaleString()}`
    );
  }

  /**
   * Schedule an arm timeout for a specific time.
   */
  private scheduleArmTimeout(
    scheduleId: string,
    scheduleName: string,
    scheduleType: "recurring" | "oneTime",
    scheduledTime: Date
  ): void {
    const now = new Date();
    const delay = scheduledTime.getTime() - now.getTime();

    if (delay <= 0) {
      console.log(
        `[SCHEDULE] Arm time for "${scheduleName}" is in the past, skipping`
      );
      return;
    }

    const timeoutId = setTimeout(async () => {
      await this.executeArm(scheduleId, scheduledTime);
    }, delay);

    this.armTimeouts.set(scheduleId, {
      scheduleId,
      scheduleName,
      scheduleType,
      timeoutId,
      scheduledTime,
    });

    console.log(
      `[SCHEDULE] Scheduled ARM for "${scheduleName}" at ${scheduledTime.toLocaleString()} (in ${Math.round(delay / 1000)}s)`
    );
  }

  /**
   * Schedule a disarm timeout for a specific time.
   */
  private scheduleDisarmTimeout(
    scheduleId: string,
    scheduleName: string,
    scheduleType: "recurring" | "oneTime",
    scheduledTime: Date
  ): void {
    const now = new Date();
    const delay = scheduledTime.getTime() - now.getTime();

    if (delay <= 0) {
      console.log(
        `[SCHEDULE] Disarm time for "${scheduleName}" is in the past, skipping`
      );
      return;
    }

    const timeoutId = setTimeout(async () => {
      await this.executeDisarm(scheduleId, scheduledTime);
    }, delay);

    this.disarmTimeouts.set(scheduleId, {
      scheduleId,
      scheduleName,
      scheduleType,
      timeoutId,
      scheduledTime,
    });

    console.log(
      `[SCHEDULE] Scheduled DISARM for "${scheduleName}" at ${scheduledTime.toLocaleString()} (in ${Math.round(delay / 1000)}s)`
    );
  }

  /**
   * Execute ARM action for a schedule.
   * After execution, reschedules only ARM for recurring schedules.
   */
  private async executeArm(
    scheduleId: string,
    scheduledTime: Date
  ): Promise<void> {
    try {
      // Remove from active timeouts
      this.armTimeouts.delete(scheduleId);

      // Get schedule from Redis
      let schedule: RecurringSchedule | OneTimeSchedule | null =
        (await recurringScheduleRepository
          .search()
          .where("id")
          .eq(scheduleId)
          .returnFirst()) as RecurringSchedule | null;

      let isRecurring = true;

      if (!schedule) {
        schedule = (await oneTimeScheduleRepository
          .search()
          .where("id")
          .eq(scheduleId)
          .returnFirst()) as OneTimeSchedule | null;
        isRecurring = false;
      }

      if (!schedule) {
        console.warn(`[SCHEDULE] Schedule ${scheduleId} not found for ARM execution`);
        return;
      }

      console.log(
        `[SCHEDULE] Executing ARM for "${schedule.name}" (${schedule.sensorIDs.length} sensor(s))`
      );

      // Get sensors for this schedule
      const sensors = await this.getSensorsForSchedule(schedule);

      if (sensors.length === 0) {
        console.warn(
          `[SCHEDULE] No sensors found for schedule "${schedule.name}"`
        );
        return;
      }

      // Calculate disarm time for retry cutoff
      const disarmTime = isRecurring
        ? this.calculateDisarmTime(schedule as RecurringSchedule, scheduledTime)
        : new Date((schedule as OneTimeSchedule).disarmDateTime);

      // Attempt to arm sensors (with retry logic for open sensors)
      await this.attemptArm(schedule, sensors, scheduledTime, disarmTime);

      // Emit updated data to clients
      await emitNewData();

      // Reschedule ARM for recurring schedules only
      if (isRecurring) {
        const nextArmTime = this.calculateNextArmTime(schedule as RecurringSchedule);
        if (nextArmTime) {
          this.scheduleArmTimeout(scheduleId, schedule.name, "recurring", nextArmTime);
        }
      }
    } catch (error) {
      console.error(`[SCHEDULE] Error executing ARM for schedule ${scheduleId}:`, error);
      await raiseEvent({
        type: "critical",
        message: `Failed to execute ARM for schedule ${scheduleId}: ${error}`,
        system: "backend:scheduleManager",
      });
    }
  }

  /**
   * Execute DISARM action for a schedule.
   * After execution, reschedules only DISARM for recurring schedules.
   * For one-time schedules, removes the schedule after disarm.
   */
  private async executeDisarm(
    scheduleId: string,
    scheduledTime: Date
  ): Promise<void> {
    try {
      // Remove from active timeouts
      this.disarmTimeouts.delete(scheduleId);

      // Get schedule from Redis
      let schedule: RecurringSchedule | OneTimeSchedule | null =
        (await recurringScheduleRepository
          .search()
          .where("id")
          .eq(scheduleId)
          .returnFirst()) as RecurringSchedule | null;

      let isRecurring = true;

      if (!schedule) {
        schedule = (await oneTimeScheduleRepository
          .search()
          .where("id")
          .eq(scheduleId)
          .returnFirst()) as OneTimeSchedule | null;
        isRecurring = false;
      }

      if (!schedule) {
        console.warn(`[SCHEDULE] Schedule ${scheduleId} not found for DISARM execution`);
        return;
      }

      console.log(
        `[SCHEDULE] Executing DISARM for "${schedule.name}" (${schedule.sensorIDs.length} sensor(s))`
      );

      // Get sensors for this schedule
      const sensors = await this.getSensorsForSchedule(schedule);

      if (sensors.length === 0) {
        console.warn(
          `[SCHEDULE] No sensors found for schedule "${schedule.name}"`
        );
        return;
      }

      // Clear any retry queues for these sensors (disarm clears all retries)
      const sensorIds = sensors.map(s => s.externalID);
      sensorIds.forEach(sensorId => {
        const retryContext = this.retryQueues.get(sensorId);
        if (retryContext) {
          if (retryContext.retryTimeoutId) {
            clearTimeout(retryContext.retryTimeoutId);
          }
          this.retryQueues.delete(sensorId);
          console.log(
            `[SCHEDULE] Cleared retry queue for sensor ${sensorId} (disarm executed)`
          );
        }
      });

      // Disarm all sensors
      await this.sensorStateChangeCallback!(sensors, false);

      const sensorNames = sensors
        .map((s) => `${s.name} (${s.building})`)
        .join(", ");
      await raiseEvent({
        type: "info",
        message: `Schedule "${schedule.name}" disarmed ${sensors.length} sensor(s): ${sensorNames}`,
        system: "backend:scheduleManager",
      });

      // Audit the disarm execution
      await this.auditScheduleExecution(
        schedule,
        "Disarm",
        sensors,
        sensors, // All sensors successfully disarmed
        [], // No failed sensors
        [] // No retried sensors for disarm
      );

      // Emit updated data to clients
      await emitNewData();

      // Reschedule DISARM for recurring schedules, or remove one-time schedules
      if (isRecurring) {
        const nextDisarmTime = this.calculateNextDisarmTime(schedule as RecurringSchedule);
        if (nextDisarmTime) {
          this.scheduleDisarmTimeout(scheduleId, schedule.name, "recurring", nextDisarmTime);
        }
      } else {
        // One-time schedule - remove after disarm
        await this.removeExpiredOneTimeSchedule(scheduleId);
      }
    } catch (error) {
      console.error(`[SCHEDULE] Error executing DISARM for schedule ${scheduleId}:`, error);
      await raiseEvent({
        type: "critical",
        message: `Failed to execute DISARM for schedule ${scheduleId}: ${error}`,
        system: "backend:scheduleManager",
      });
    }
  }

  /**
   * Attempt to arm sensors with retry logic if they're open.
   * Works sensor-by-sensor instead of building-based.
   */
  private async attemptArm(
    schedule: RecurringSchedule | OneTimeSchedule,
    sensors: doorSensor[],
    armTime: Date,
    disarmTime: Date
  ): Promise<void> {
    const scheduleId = schedule.id;
    const closedSensors: doorSensor[] = [];
    const openSensors: doorSensor[] = [];

    // Separate closed and open sensors
    sensors.forEach((sensor) => {
      if (sensor.state === "closed") {
        closedSensors.push(sensor);
      } else {
        openSensors.push(sensor);
      }
    });

    // Arm closed sensors immediately
    if (closedSensors.length > 0) {
      await this.sensorStateChangeCallback!(closedSensors, true);

      const sensorNames = closedSensors
        .map((s) => `${s.name} (${s.building})`)
        .join(", ");
      await raiseEvent({
        type: "info",
        message: `Schedule "${schedule.name}" armed ${closedSensors.length} sensor(s): ${sensorNames}`,
        system: "backend:scheduleManager",
      });
    }

    // Set up retry logic for open sensors
    if (openSensors.length > 0) {
      await this.setupRetryForOpenSensors(
        scheduleId,
        schedule.name,
        openSensors,
        armTime,
        disarmTime
      );
    }

    // Audit the execution (including both successful and pending retry sensors)
    await this.auditScheduleExecution(
      schedule,
      "Arm",
      sensors,
      closedSensors,
      [], // No failed sensors at this point
      openSensors // Sensors that need retry
    );
  }

  /**
   * Set up retry logic for open sensors.
   * Creates individual retry contexts for each open sensor.
   */
  private async setupRetryForOpenSensors(
    scheduleId: string,
    scheduleName: string,
    openSensors: doorSensor[],
    armTime: Date,
    disarmTime: Date
  ): Promise<void> {
    for (const sensor of openSensors) {
      // Check if we already have a retry context for this sensor
      let retryContext = this.retryQueues.get(sensor.externalID);

      if (!retryContext) {
        // Create new retry context for this sensor
        retryContext = {
          scheduleId,
          scheduleName,
          sensorId: sensor.externalID,
          sensorName: sensor.name,
          sensorBuilding: sensor.building,
          armTime,
          disarmTime,
          retryCount: 0,
          warningEmitted: false,
        };

        this.retryQueues.set(sensor.externalID, retryContext);
      }

      // Emit warning only once per sensor
      if (!retryContext.warningEmitted) {
        await raiseEvent({
          type: "warning",
          message: `Cannot arm sensor ${sensor.name} in ${sensor.building} - sensor is open. Will retry every ${RETRY_INTERVAL_SECONDS} seconds until disarm time.`,
          system: "backend:scheduleManager",
        });
        retryContext.warningEmitted = true;
      }

      // Schedule retry for this sensor
      retryContext.retryTimeoutId = setTimeout(() => {
        this.handleSensorRetry(retryContext!);
      }, RETRY_INTERVAL_SECONDS * 1000);

      console.log(
        `[SCHEDULE] Set up retry for sensor "${sensor.name}" in schedule "${scheduleName}" - ` +
        `attempt ${retryContext.retryCount + 1}, cutoff at ${disarmTime.toLocaleString()}`
      );
    }
  }

  /**
   * Handle retry attempt for a specific sensor.
   */
  private async handleSensorRetry(context: RetryContext): Promise<void> {
    // Check if we should stop retrying (disarm time reached)
    if (new Date() >= context.disarmTime) {
      console.log(
        `[SCHEDULE] Stopping retry for sensor ${context.sensorName} in ${context.sensorBuilding} - disarm time reached`
      );
      this.retryQueues.delete(context.sensorId);
      return;
    }

    context.retryCount++;
    console.log(
      `[SCHEDULE] Retry attempt ${context.retryCount} for sensor ${context.sensorName} in schedule ${context.scheduleName}`
    );

    // Get current sensor state
    const sensor = (await doorSensorRepository
      .search()
      .where("externalID")
      .eq(context.sensorId)
      .returnFirst()) as doorSensor;

    if (!sensor) {
      console.warn(
        `[SCHEDULE] Sensor ${context.sensorId} not found during retry`
      );
      this.retryQueues.delete(context.sensorId);
      return;
    }

    if (sensor.state === "closed") {
      // Sensor is now closed, arm it
      await this.sensorStateChangeCallback!([sensor], true);

      await raiseEvent({
        type: "info",
        message: `Schedule "${context.scheduleName}" successfully armed sensor ${context.sensorName} in ${context.sensorBuilding} after ${context.retryCount} retries`,
        system: "backend:scheduleManager",
      });

      // Audit the successful retry
      try {
        // Get the original schedule to audit this successful retry
        let schedule: RecurringSchedule | OneTimeSchedule | null =
          (await recurringScheduleRepository
            .search()
            .where("id")
            .eq(context.scheduleId)
            .returnFirst()) as RecurringSchedule | null;

        if (!schedule) {
          schedule = (await oneTimeScheduleRepository
            .search()
            .where("id")
            .eq(context.scheduleId)
            .returnFirst()) as OneTimeSchedule | null;
        }

        if (schedule) {
          await this.auditScheduleExecution(
            schedule,
            "Arm",
            [sensor],
            [sensor], // Successfully armed
            [], // No failed sensors
            [sensor] // This sensor was retried
          );
        }
      } catch (error) {
        console.error(`[SCHEDULE] Error auditing successful retry:`, error);
      }

      // Remove from retry queue
      this.retryQueues.delete(context.sensorId);

      // Emit updated data to clients
      await emitNewData();
    } else {
      // Sensor still open, schedule another retry
      context.retryTimeoutId = setTimeout(() => {
        this.handleSensorRetry(context);
      }, RETRY_INTERVAL_SECONDS * 1000);
    }
  }

  /**
   * Calculate next arm time for a recurring schedule.
   */
  private calculateNextArmTime(schedule: RecurringSchedule): Date | null {
    const now = new Date();
    const [hours, minutes] = schedule.armTime.split(":").map(Number);

    if (schedule.recurrence === "Daily") {
      const nextArm = new Date();
      nextArm.setHours(hours, minutes, 0, 0);

      // Apply day offset
      nextArm.setDate(nextArm.getDate() + schedule.armDayOffset);

      // If time has passed today, schedule for tomorrow
      if (nextArm <= now) {
        nextArm.setDate(nextArm.getDate() + 1);
      }

      return nextArm;
    }

    if (schedule.recurrence === "Weekly") {
      const days = schedule.days ? JSON.parse(schedule.days) : [];
      if (days.length === 0) return null;

      const dayMap: { [key: string]: number } = {
        Sunday: 0,
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6,
      };

      const todayIndex = now.getDay();
      const scheduleDayIndices = days
        .map((day: string) => dayMap[day])
        .filter((idx: number) => idx !== undefined)
        .sort((a: number, b: number) => a - b);

      if (scheduleDayIndices.length === 0) return null;

      // Find next scheduled day
      const nextArm = new Date();
      nextArm.setHours(hours, minutes, 0, 0);

      // Find the next matching day
      let foundDay = false;
      for (let i = 0; i < 14; i++) { // Check up to 2 weeks ahead
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() + i);
        const checkDayIndex = checkDate.getDay();

        if (scheduleDayIndices.includes(checkDayIndex)) {
          const candidateArm = new Date(checkDate);
          candidateArm.setHours(hours, minutes, 0, 0);
          candidateArm.setDate(candidateArm.getDate() + schedule.armDayOffset);

          if (candidateArm > now) {
            return candidateArm;
          }
        }
      }

      return null;
    }

    return null;
  }

  /**
   * Calculate next disarm time for a recurring schedule.
   */
  private calculateNextDisarmTime(schedule: RecurringSchedule): Date | null {
    const now = new Date();
    const [hours, minutes] = schedule.disarmTime.split(":").map(Number);

    if (schedule.recurrence === "Daily") {
      const nextDisarm = new Date();
      nextDisarm.setHours(hours, minutes, 0, 0);

      // Apply day offset
      nextDisarm.setDate(nextDisarm.getDate() + schedule.disarmDayOffset);

      // If time has passed today, schedule for tomorrow
      if (nextDisarm <= now) {
        nextDisarm.setDate(nextDisarm.getDate() + 1);
      }

      return nextDisarm;
    }

    if (schedule.recurrence === "Weekly") {
      const days = schedule.days ? JSON.parse(schedule.days) : [];
      if (days.length === 0) return null;

      const dayMap: { [key: string]: number } = {
        Sunday: 0,
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6,
      };

      const scheduleDayIndices = days
        .map((day: string) => dayMap[day])
        .filter((idx: number) => idx !== undefined)
        .sort((a: number, b: number) => a - b);

      if (scheduleDayIndices.length === 0) return null;

      // Find next scheduled day (same logic as arm, but with disarmTime and disarmDayOffset)
      for (let i = 0; i < 14; i++) { // Check up to 2 weeks ahead
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() + i);
        const checkDayIndex = checkDate.getDay();

        if (scheduleDayIndices.includes(checkDayIndex)) {
          const candidateDisarm = new Date(checkDate);
          candidateDisarm.setHours(hours, minutes, 0, 0);
          candidateDisarm.setDate(candidateDisarm.getDate() + schedule.disarmDayOffset);

          if (candidateDisarm > now) {
            return candidateDisarm;
          }
        }
      }

      return null;
    }

    return null;
  }

  /**
   * Calculate disarm time based on arm time for retry cutoff.
   * For recurring schedules, this calculates the disarm time relative to the arm time.
   */
  private calculateDisarmTime(
    schedule: RecurringSchedule,
    armTime: Date
  ): Date {
    const [hours, minutes] = schedule.disarmTime.split(":").map(Number);

    const disarmTime = new Date(armTime);
    disarmTime.setHours(hours, minutes, 0, 0);

    // Apply day offset relative to arm time
    const dayDifference = schedule.disarmDayOffset - schedule.armDayOffset;
    disarmTime.setDate(disarmTime.getDate() + dayDifference);

    return disarmTime;
  }

  /**
   * Get sensors for a schedule.
   */
  private async getSensorsForSchedule(
    schedule: RecurringSchedule | OneTimeSchedule
  ): Promise<doorSensor[]> {
    const sensors = await Promise.all(
      schedule.sensorIDs.map(async (id) => {
        return (await doorSensorRepository
          .search()
          .where("externalID")
          .eq(id)
          .returnFirst()) as doorSensor;
      })
    );
    return sensors.filter((s) => s !== null);
  }

  /**
   * Audit schedule execution to PostgreSQL for persistent storage.
   */
  private async auditScheduleExecution(
    schedule: RecurringSchedule | OneTimeSchedule,
    executionType: "Arm" | "Disarm",
    sensors: doorSensor[],
    successfulSensors: doorSensor[],
    failedSensors: doorSensor[] = [],
    retriedSensors: doorSensor[] = []
  ): Promise<void> {
    try {
      const scheduleId = schedule.id;

      // Prepare sensor data
      const sensorsAffected = sensors.map((s) => ({
        id: s.externalID,
        name: s.name,
        building: s.building,
        state: s.state,
      }));

      // Build audit data based on schedule type
      const baseAuditData = {
        scheduleId,
        scheduleName: schedule.name,
        scheduleType: ("recurrence" in schedule ? "recurring" : "oneTime") as "recurring" | "oneTime",
        executionType,
        sensorIds: schedule.sensorIDs,
        sensorsAffected,
        successfulSensors: successfulSensors.map((s) => s.externalID),
        failedSensors: failedSensors.map((s) => s.externalID),
        retriedSensors:
          retriedSensors.length > 0
            ? retriedSensors.map((s) => s.externalID)
            : null,
      };

      let auditData;

      // Add type-specific fields
      if ("recurrence" in schedule) {
        // Recurring schedule
        auditData = {
          ...baseAuditData,
          armTime: schedule.armTime,
          armDayOffset: schedule.armDayOffset,
          disarmTime: schedule.disarmTime,
          disarmDayOffset: schedule.disarmDayOffset,
          recurrence: schedule.recurrence,
          days: schedule.days
            ? typeof schedule.days === "string"
              ? JSON.parse(schedule.days)
              : schedule.days
            : null,
          active: schedule.active,
          armDateTime: null,
          disarmDateTime: null,
        };
      } else {
        // One-time schedule
        auditData = {
          ...baseAuditData,
          armTime: null,
          armDayOffset: null,
          disarmTime: null,
          disarmDayOffset: null,
          recurrence: null,
          days: null,
          active: null,
          armDateTime: new Date(schedule.armDateTime),
          disarmDateTime: new Date(schedule.disarmDateTime),
        };
      }

      // Insert into PostgreSQL
      await db.insert(scheduleExecutionTable).values(auditData);

      console.log(
        `[SCHEDULE] Audited ${executionType} execution of schedule "${schedule.name}" to PostgreSQL`
      );
    } catch (error) {
      console.error(`[SCHEDULE] Error auditing schedule execution:`, error);
      // Don't throw - auditing failure shouldn't stop schedule execution
    }
  }

  /**
   * Remove expired one-time schedule from Redis.
   */
  private async removeExpiredOneTimeSchedule(
    scheduleId: string
  ): Promise<void> {
    try {
      await oneTimeScheduleRepository.remove(scheduleId);
      console.log(
        `[SCHEDULE] Removed expired one-time schedule ${scheduleId}`
      );

      // Also clear any timeouts for this schedule
      const armTimeout = this.armTimeouts.get(scheduleId);
      if (armTimeout) {
        clearTimeout(armTimeout.timeoutId);
        this.armTimeouts.delete(scheduleId);
      }

      const disarmTimeout = this.disarmTimeouts.get(scheduleId);
      if (disarmTimeout) {
        clearTimeout(disarmTimeout.timeoutId);
        this.disarmTimeouts.delete(scheduleId);
      }
    } catch (error) {
      console.error(
        `[SCHEDULE] Error removing expired schedule ${scheduleId}:`,
        error
      );
    }
  }

  /**
   * Set up daily check at midnight for schedule cleanup and day transitions.
   */
  private setupDailyCheck(): void {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);

    const msUntilMidnight = midnight.getTime() - now.getTime();

    // Set timeout until midnight
    this.dailyCheckTimer = setTimeout(async () => {
      await this.performDailyCheck();

      // Set up next day's check (recursive)
      this.setupDailyCheck();
    }, msUntilMidnight);

    console.log(
      `[SCHEDULE] Daily check scheduled for ${midnight.toLocaleString()}`
    );
  }

  /**
   * Perform daily maintenance tasks.
   */
  private async performDailyCheck(): Promise<void> {
    console.log("[SCHEDULE] Performing daily schedule check");

    // Clean up expired one-time schedules
    const oneTimeSchedules = (await oneTimeScheduleRepository
      .search()
      .returnAll()) as OneTimeSchedule[];

    const now = new Date();
    for (const schedule of oneTimeSchedules) {
      if (new Date(schedule.disarmDateTime) < now) {
        const scheduleId = schedule.id;
        await this.removeExpiredOneTimeSchedule(scheduleId);
      }
    }

    console.log("[SCHEDULE] Daily check completed");
  }

  /**
   * Get status information about the manager.
   */
  getStatus(): {
    isRunning: boolean;
    armTimeouts: number;
    disarmTimeouts: number;
    activeRetries: number;
  } {
    return {
      isRunning: this.isRunningFlag,
      armTimeouts: this.armTimeouts.size,
      disarmTimeouts: this.disarmTimeouts.size,
      activeRetries: this.retryQueues.size,
    };
  }

  /**
   * Get active retry contexts (for debugging/monitoring).
   */
  getActiveRetries(): RetryContext[] {
    return Array.from(this.retryQueues.values());
  }

  /**
   * Get scheduled actions (for debugging/monitoring).
   */
  getScheduledActions(): {
    arms: ScheduledAction[];
    disarms: ScheduledAction[];
  } {
    return {
      arms: Array.from(this.armTimeouts.values()),
      disarms: Array.from(this.disarmTimeouts.values()),
    };
  }

  /**
   * Check if the manager is running.
   */
  isRunning(): boolean {
    return this.isRunningFlag;
  }
}

/**
 * Singleton instance of the ScheduleManager.
 */
export const scheduleManager = new ScheduleManager();
