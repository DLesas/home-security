import { doorSensorRepository, type doorSensor } from "./redis/doorSensors";
import { alarmRepository, type Alarm } from "./redis/alarms";
import { raiseEvent } from "./events/notify";
import { sensorUpdatesTable } from "./db/schema/sensorUpdates";
import { alarmUpdatesTable } from "./db/schema/alarmUpdates";
import { db } from "./db/db";
import { emitNewData } from "./express/socketHandler";
import { setSensorStatusUnknown } from "./sensorFuncs";

/**
 * This is a singleton class that is used to monitor the timeout status of all sensors and alarms.
 *
 * This class creates individual intervals for each sensor and alarm based on their
 * `expectedSecondsUpdated` value. Each interval continuously monitors the
 * device's `lastUpdated` timestamp and marks the device as "unknown" if
 * it hasn't reported within the expected timeframe.
 *
 *
 * @example
 * ```typescript
 * // Start monitoring all sensors and alarms
 * await sensorTimeoutMonitor.start();
 *
 * // Recreate intervals when devices are added/removed
 * await sensorTimeoutMonitor.recreateAllIntervals();
 *
 * // Check if monitor is running
 * if (sensorTimeoutMonitor.isRunning()) {
 *   console.log(`Monitoring ${sensorTimeoutMonitor.getActiveSensorIntervalCount()} sensors and ${sensorTimeoutMonitor.getActiveAlarmIntervalCount()} alarms`);
 * }
 * ```
 */
export class SensorTimeoutMonitor {
  /** Array of active sensor interval IDs for cleanup purposes */
  private sensorIntervalIds: ReturnType<typeof setInterval>[] = [];
  /** Array of active alarm interval IDs for cleanup purposes */
  private alarmIntervalIds: ReturnType<typeof setInterval>[] = [];
  /** Flag indicating whether the monitor is currently running */
  private isRunningFlag: boolean = false;

  constructor() {
    // No initialization needed - monitor starts in stopped state
  }

  /**
   * Start the timeout monitoring service.
   *
   * Creates individual intervals for each sensor and alarm based on their `expectedSecondsUpdated`
   * value. Each interval will continuously check the device's timeout status.
   *
   * @throws {Error} If there's an error fetching sensors or alarms from Redis
   * @returns {Promise<void>} Resolves when the monitor has started successfully
   *
   * @example
   * ```typescript
   * await sensorTimeoutMonitor.start();
   * console.log("Device timeout monitoring started");
   * ```
   */
  async start(): Promise<void> {
    if (this.isRunningFlag) {
      console.warn("SensorTimeoutMonitor is already running");
      return;
    }
    console.log("Starting device timeout monitoring...");
    this.isRunningFlag = true;
    await this.createAllSensorIntervals();
    await this.createAllAlarmIntervals();
    console.log(
      `SensorTimeoutMonitor started with ${this.sensorIntervalIds.length} sensor intervals and ${this.alarmIntervalIds.length} alarm intervals`
    );
  }

  /**
   * Stop the timeout monitoring service.
   *
   * Clears all interval timers and cleans up resources. This method is
   * safe to call multiple times - subsequent calls will be ignored.
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * sensorTimeoutMonitor.stop();
   * console.log("Device timeout monitoring stopped");
   * ```
   */
  stop(): void {
    if (!this.isRunningFlag) {
      console.warn("SensorTimeoutMonitor is not running");
      return;
    }

    console.log("Stopping device timeout monitoring...");

    // Clear all sensor interval timers
    this.sensorIntervalIds.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.sensorIntervalIds = [];

    // Clear all alarm interval timers
    this.alarmIntervalIds.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.alarmIntervalIds = [];

    this.isRunningFlag = false;
    console.log("SensorTimeoutMonitor stopped");
  }

  /**
   * Recreate all sensor and alarm intervals.
   *
   * Clears existing intervals and creates new ones for all sensors and alarms.
   * This is useful when devices are added or removed from the system,
   * ensuring the monitor stays in sync with the current device list.
   *
   * @throws {Error} If there's an error fetching sensors or alarms from Redis
   * @returns {Promise<void>} Resolves when all intervals have been recreated
   *
   * @example
   * ```typescript
   * // After adding/removing devices
   * await sensorTimeoutMonitor.recreateAllIntervals();
   * console.log("Device intervals recreated");
   * ```
   */
  async recreateAllIntervals(): Promise<void> {
    console.log("Recreating all device intervals...");

    // Clear sensor intervals
    this.sensorIntervalIds.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.sensorIntervalIds = [];

    // Clear alarm intervals
    this.alarmIntervalIds.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.alarmIntervalIds = [];

    await this.createAllSensorIntervals();
    await this.createAllAlarmIntervals();
    console.log(
      `Recreated ${this.sensorIntervalIds.length} sensor intervals and ${this.alarmIntervalIds.length} alarm intervals`
    );
  }

  /**
   * Create individual intervals for all sensors.
   *
   * Fetches all sensors from Redis and creates an individual interval
   * for each sensor based on its `expectedSecondsUpdated` value.
   *
   * @private
   * @throws {Error} If there's an error fetching sensors from Redis
   * @returns {Promise<void>} Resolves when all intervals have been created
   */
  private async createAllSensorIntervals(): Promise<void> {
    try {
      // Fetch all sensors from Redis as Entities and create an interval for each
      const sensors = (await doorSensorRepository
        .search()
        .return.all()) as any[];
      sensors.forEach((sensorEntity) => {
        this.createSensorInterval(sensorEntity as doorSensor);
      });
    } catch (error) {
      console.error("Error creating sensor intervals:", error);
      await raiseEvent({
        type: "warning",
        message: `Failed to create sensor intervals: ${error}`,
        system: "backend:sensorTimeoutMonitor",
      });
    }
  }

  /**
   * Create individual intervals for all alarms.
   *
   * Fetches all alarms from Redis and creates an individual interval
   * for each alarm based on its `expectedSecondsUpdated` value.
   *
   * @private
   * @throws {Error} If there's an error fetching alarms from Redis
   * @returns {Promise<void>} Resolves when all intervals have been created
   */
  private async createAllAlarmIntervals(): Promise<void> {
    try {
      // Fetch all alarms from Redis as Entities and create an interval for each
      const alarms = (await alarmRepository.search().return.all()) as any[];
      alarms.forEach((alarmEntity) => {
        this.createAlarmInterval(alarmEntity as Alarm);
      });
    } catch (error) {
      console.error("Error creating alarm intervals:", error);
      await raiseEvent({
        type: "warning",
        message: `Failed to create alarm intervals: ${error}`,
        system: "backend:sensorTimeoutMonitor",
      });
    }
  }

  /**
   * Create an individual interval for a specific sensor.
   *
   * The interval runs every `expectedSecondsUpdated` seconds and checks
   * the sensor's `lastUpdated` timestamp to determine if it has timed out.
   *
   * @private
   * @param {doorSensor} sensor - The sensor to monitor
   * @returns {void}
   */
  private createSensorInterval(sensor: doorSensor): void {
    const intervalMs = sensor.expectedSecondsUpdated * 1000; // Convert seconds to milliseconds

    const intervalId = setInterval(async () => {
      await this.checkSensorTimeout(sensor);
    }, intervalMs);
    this.sensorIntervalIds.push(intervalId);
  }

  /**
   * Create an individual interval for a specific alarm.
   *
   * The interval runs every `expectedSecondsUpdated` seconds and checks
   * the alarm's `lastUpdated` timestamp to determine if it has timed out.
   *
   * @private
   * @param {Alarm} alarm - The alarm to monitor
   * @returns {void}
   */
  private createAlarmInterval(alarm: Alarm): void {
    const intervalMs = alarm.expectedSecondsUpdated * 1000; // Convert seconds to milliseconds

    const intervalId = setInterval(async () => {
      await this.checkAlarmTimeout(alarm);
    }, intervalMs);
    this.alarmIntervalIds.push(intervalId);
  }

  /**
   * Check if a specific sensor has timed out.
   *
   * Compares the current time against the sensor's `lastUpdated` timestamp
   * and marks the sensor as "unknown" if it has exceeded its `expectedSecondsUpdated`
   * threshold. Also handles recovery detection when sensors come back online.
   *
   * @private
   * @param {doorSensor} sensor - The sensor to check for timeout
   * @returns {Promise<void>} Resolves when the timeout check is complete
   */
  private async checkSensorTimeout(sensor: doorSensor): Promise<void> {
    try {
      // Always fetch latest entity snapshot before checking timeout
      const fresh = (await doorSensorRepository
        .search()
        .where("externalID")
        .eq(sensor.externalID)
        .returnFirst()) as doorSensor | null;
      if (!fresh) return;

      // Get current timestamp
      const now = new Date();

      // Calculate time since last update in seconds
      const timeSinceLastUpdate =
        (now.getTime() - fresh.lastUpdated.getTime()) / 1000;

      // Check if sensor has timed out
      if (timeSinceLastUpdate > fresh.expectedSecondsUpdated) {
        // Sensor has timed out - mark as unknown
        if (fresh.state !== "unknown") {
          console.log(
            `Sensor ${
              fresh.externalID
            } timed out (${timeSinceLastUpdate.toFixed(0)}s since last update)`
          );
          // Use shared function to update sensor state to unknown (safely updates entity)
          await setSensorStatusUnknown([fresh]);
          db.insert(sensorUpdatesTable).values({
            sensorId: fresh.externalID,
            state: "unknown",
            temperature: undefined,
            voltage: undefined,
            frequency: undefined,
          });
          // Raise warning event
          await raiseEvent({
            type: "warning",
            message: `Sensor ${fresh.name} in ${
              fresh.building
            } marked as unknown due to timeout (${timeSinceLastUpdate.toFixed(
              0
            )}s since last update)`,
            system: "backend:sensorTimeoutMonitor",
          });
          await emitNewData();
        }
      } else {
        // Sensor is still active - log recovery if it was previously unknown
        if (fresh.state === "unknown") {
          console.log(
            `Sensor ${fresh.name} in ${fresh.building} recovered from unknown state`
          );
          await raiseEvent({
            type: "info",
            message: `Sensor ${fresh.name} in ${fresh.building} recovered from unknown state`,
            system: "backend:sensorTimeoutMonitor",
          });
          await emitNewData();
        }
      }
    } catch (error) {
      console.error(
        `Error checking timeout for sensor ${sensor.externalID}:`,
        error
      );
      // TODO: Handle error, maybe an error log drain
    }
  }

  /**
   * Check if a specific alarm has timed out.
   *
   * Compares the current time against the alarm's `lastUpdated` timestamp
   * and marks the alarm as "unknown" if it has exceeded its `expectedSecondsUpdated`
   * threshold. Also handles recovery detection when alarms come back online.
   *
   * @private
   * @param {Alarm} alarm - The alarm to check for timeout
   * @returns {Promise<void>} Resolves when the timeout check is complete
   */
  private async checkAlarmTimeout(alarm: Alarm): Promise<void> {
    try {
      // Always fetch latest entity snapshot before checking timeout
      const fresh = (await alarmRepository
        .search()
        .where("externalID")
        .eq(alarm.externalID)
        .returnFirst()) as Alarm | null;
      if (!fresh) return;

      // Get current timestamp
      const now = new Date();

      // Calculate time since last update in seconds
      const timeSinceLastUpdate =
        (now.getTime() - fresh.lastUpdated.getTime()) / 1000;

      // Check if alarm has timed out
      if (timeSinceLastUpdate > fresh.expectedSecondsUpdated) {
        // Alarm has timed out - mark as unknown
        if (fresh.state !== "unknown") {
          console.log(
            `Alarm ${fresh.externalID} timed out (${timeSinceLastUpdate.toFixed(
              0
            )}s since last update)`
          );
          // Update alarm using explicit ID to avoid duplicates
          await alarmRepository.save(fresh.externalID, {
            ...fresh,
            state: "unknown",
            lastUpdated: new Date(),
          });
          await db.insert(alarmUpdatesTable).values({
            alarmId: fresh.externalID,
            state: "unknown",
            temperature: null,
            voltage: null,
            frequency: null,
          });
          // Raise warning event
          await raiseEvent({
            type: "warning",
            message: `Alarm ${fresh.name} in ${
              fresh.building
            } marked as unknown due to timeout (${timeSinceLastUpdate.toFixed(
              0
            )}s since last update)`,
            system: "backend:sensorTimeoutMonitor",
          });
          await emitNewData();
        }
      } else {
        // Alarm is still active - log recovery if it was previously unknown
        if (fresh.state === "unknown") {
          console.log(
            `Alarm ${fresh.name} in ${fresh.building} recovered from unknown state`
          );
          await raiseEvent({
            type: "info",
            message: `Alarm ${fresh.name} in ${fresh.building} recovered from unknown state`,
            system: "backend:sensorTimeoutMonitor",
          });
          await emitNewData();
        }
      }
    } catch (error) {
      console.error(
        `Error checking timeout for alarm ${alarm.externalID}:`,
        error
      );
      // TODO: Handle error, maybe an error log drain
    }
  }

  /**
   * Get the current monitoring status.
   *
   * @returns {boolean} `true` if the monitor is currently running, `false` otherwise
   *
   * @example
   * ```typescript
   * if (sensorTimeoutMonitor.isRunning()) {
   *   console.log("Monitor is active");
   * } else {
   *   console.log("Monitor is stopped");
   * }
   * ```
   */
  isRunning(): boolean {
    return this.isRunningFlag;
  }

  /**
   * Get the number of active sensor intervals.
   *
   * @returns {number} The current number of sensor intervals being monitored
   *
   * @example
   * ```typescript
   * const activeSensorCount = sensorTimeoutMonitor.getActiveSensorIntervalCount();
   * console.log(`Monitoring ${activeSensorCount} sensors`);
   * ```
   */
  getActiveSensorIntervalCount(): number {
    return this.sensorIntervalIds.length;
  }

  /**
   * Get the number of active alarm intervals.
   *
   * @returns {number} The current number of alarm intervals being monitored
   *
   * @example
   * ```typescript
   * const activeAlarmCount = sensorTimeoutMonitor.getActiveAlarmIntervalCount();
   * console.log(`Monitoring ${activeAlarmCount} alarms`);
   * ```
   */
  getActiveAlarmIntervalCount(): number {
    return this.alarmIntervalIds.length;
  }

  /**
   * Get all active sensor interval IDs.
   *
   * Returns a copy of the sensor interval IDs array for debugging/testing purposes.
   * The returned array is a copy to prevent external modification.
   *
   * @returns {ReturnType<typeof setInterval>[]} Array of all current sensor interval IDs
   *
   * @example
   * ```typescript
   * const sensorIntervalIds = sensorTimeoutMonitor.getSensorIntervalIds();
   * console.log(`Active sensor intervals: ${sensorIntervalIds.length}`);
   * ```
   */
  getSensorIntervalIds(): ReturnType<typeof setInterval>[] {
    return [...this.sensorIntervalIds]; // Return copy to prevent external modification
  }

  /**
   * Get all active alarm interval IDs.
   *
   * Returns a copy of the alarm interval IDs array for debugging/testing purposes.
   * The returned array is a copy to prevent external modification.
   *
   * @returns {ReturnType<typeof setInterval>[]} Array of all current alarm interval IDs
   *
   * @example
   * ```typescript
   * const alarmIntervalIds = sensorTimeoutMonitor.getAlarmIntervalIds();
   * console.log(`Active alarm intervals: ${alarmIntervalIds.length}`);
   * ```
   */
  getAlarmIntervalIds(): ReturnType<typeof setInterval>[] {
    return [...this.alarmIntervalIds]; // Return copy to prevent external modification
  }

  /**
   * Get the total number of active intervals (sensors + alarms).
   *
   * @returns {number} The total number of device intervals being monitored
   *
   * @example
   * ```typescript
   * const totalCount = sensorTimeoutMonitor.getActiveIntervalCount();
   * console.log(`Monitoring ${totalCount} total devices`);
   * ```
   */
  getActiveIntervalCount(): number {
    return this.sensorIntervalIds.length + this.alarmIntervalIds.length;
  }

  /**
   * Get all active interval IDs (sensors + alarms).
   *
   * Returns a copy of all interval IDs array for debugging/testing purposes.
   * The returned array is a copy to prevent external modification.
   *
   * @returns {ReturnType<typeof setInterval>[]} Array of all current interval IDs
   *
   * @example
   * ```typescript
   * const intervalIds = sensorTimeoutMonitor.getIntervalIds();
   * console.log(`Active intervals: ${intervalIds.length}`);
   * ```
   */
  getIntervalIds(): ReturnType<typeof setInterval>[] {
    return [...this.sensorIntervalIds, ...this.alarmIntervalIds]; // Return copy to prevent external modification
  }
}

/**
 * Singleton instance of the SensorTimeoutMonitor for use across the application.
 *
 * This instance is shared across all modules that need to interact with
 * the device timeout monitoring system.
 *
 * @example
 * ```typescript
 * import { sensorTimeoutMonitor } from './sensorTimeoutMonitor';
 *
 * // Start monitoring
 * await sensorTimeoutMonitor.start();
 *
 * // Use in routes
 * await sensorTimeoutMonitor.recreateAllIntervals();
 * ```
 */
export const sensorTimeoutMonitor = new SensorTimeoutMonitor();
