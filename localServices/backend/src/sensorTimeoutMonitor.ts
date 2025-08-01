import { doorSensorRepository, type doorSensor } from "./redis/doorSensors";
import { raiseEvent } from "./events/notify";
import { sensorUpdatesTable } from "./db/schema/sensorUpdates";
import { db } from "./db/db";

/**
 * This is a singleton class that is used to monitor the timeout status of all sensors.
 * 
 * This class creates individual intervals for each sensor based on their
 * `expectedSecondsUpdated` value. Each interval continuously monitors the
 * sensor's `lastUpdated` timestamp and marks the sensor as "unknown" if
 * it hasn't reported within the expected timeframe.
 * 
 *
 * @example
 * ```typescript
 * // Start monitoring all sensors
 * await sensorTimeoutMonitor.start();
 *
 * // Recreate intervals when sensors are added/removed
 * await sensorTimeoutMonitor.recreateAllIntervals();
 *
 * // Check if monitor is running
 * if (sensorTimeoutMonitor.isRunning()) {
 *   console.log(`Monitoring ${sensorTimeoutMonitor.getActiveIntervalCount()} sensors`);
 * }
 * ```
 */
export class SensorTimeoutMonitor {
  /** Array of active interval IDs for cleanup purposes */
  private intervalIds: NodeJS.Timeout[] = [];
  /** Flag indicating whether the monitor is currently running */
  private isRunningFlag: boolean = false;

  constructor() {
    // No initialization needed - monitor starts in stopped state
  }

  /**
   * Start the timeout monitoring service.
   *
   * Creates individual intervals for each sensor based on their `expectedSecondsUpdated`
   * value. Each interval will continuously check the sensor's timeout status.
   *
   * @throws {Error} If there's an error fetching sensors from Redis
   * @returns {Promise<void>} Resolves when the monitor has started successfully
   *
   * @example
   * ```typescript
   * await sensorTimeoutMonitor.start();
   * console.log("Sensor timeout monitoring started");
   * ```
   */
  async start(): Promise<void> {
    if (this.isRunningFlag) {
      console.warn("SensorTimeoutMonitor is already running");
      return;
    }
    console.log("Starting sensor timeout monitoring...");
    this.isRunningFlag = true;
    await this.createAllSensorIntervals();
    console.log(
      `SensorTimeoutMonitor started with ${this.intervalIds.length} sensor intervals`
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
   * console.log("Sensor timeout monitoring stopped");
   * ```
   */
  stop(): void {
    if (!this.isRunningFlag) {
      console.warn("SensorTimeoutMonitor is not running");
      return;
    }

    console.log("Stopping sensor timeout monitoring...");

    // Clear all interval timers
    this.intervalIds.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.intervalIds = [];
    this.isRunningFlag = false;
    console.log("SensorTimeoutMonitor stopped");
  }

  /**
   * Recreate all sensor intervals.
   *
   * Clears existing intervals and creates new ones for all sensors.
   * This is useful when sensors are added or removed from the system,
   * ensuring the monitor stays in sync with the current sensor list.
   *
   * @throws {Error} If there's an error fetching sensors from Redis
   * @returns {Promise<void>} Resolves when all intervals have been recreated
   *
   * @example
   * ```typescript
   * // After adding/removing sensors
   * await sensorTimeoutMonitor.recreateAllIntervals();
   * console.log("Sensor intervals recreated");
   * ```
   */
  async recreateAllIntervals(): Promise<void> {
    console.log("Recreating all sensor intervals...");
    this.intervalIds.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.intervalIds = [];
    await this.createAllSensorIntervals();
    console.log(`Recreated ${this.intervalIds.length} sensor intervals`);
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
      // Fetch all sensors from Redis
      const sensors = (await doorSensorRepository
        .search()
        .return.all()) as doorSensor[];

      // Create an interval for each sensor
      sensors.forEach((sensorData) => {
        // Convert Redis data to doorSensor type
        const sensor: doorSensor = {
          name: sensorData.name,
          externalID: sensorData.externalID,
          building: sensorData.building,
          armed: sensorData.armed,
          state: sensorData.state,
          ipAddress: sensorData.ipAddress,
          macAddress: sensorData.macAddress,
          temperature: sensorData.temperature,
          voltage: sensorData.voltage,
          frequency: sensorData.frequency,
          expectedSecondsUpdated: sensorData.expectedSecondsUpdated,
          lastUpdated: new Date(sensorData.lastUpdated),
        };

        this.createSensorInterval(sensor);
      });
    } catch (error) {
      console.error("Error creating sensor intervals:", error);
      await raiseEvent({
        type: "critical",
        message: `Failed to create sensor intervals: ${error}`,
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
    this.intervalIds.push(intervalId);
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
      // Get current timestamp
      const now = new Date();

      // Calculate time since last update in seconds
      const timeSinceLastUpdate =
        (now.getTime() - sensor.lastUpdated.getTime()) / 1000;

      // Check if sensor has timed out
      if (timeSinceLastUpdate > sensor.expectedSecondsUpdated) {
        // Sensor has timed out - mark as unknown
        if (sensor.state !== "unknown") {
          console.log(
            `Sensor ${
              sensor.externalID
            } timed out (${timeSinceLastUpdate.toFixed(0)}s since last update)`
          );

          // Update sensor state to unknown
          sensor.state = "unknown";
          await doorSensorRepository.save(sensor);
          db.insert(sensorUpdatesTable).values({
            sensorId: sensor.externalID,
            state: "unknown",
            temperature: undefined,
            voltage: undefined,
            frequency: undefined,
          });
          // Raise warning event
          await raiseEvent({
            type: "warning",
            message: `Sensor ${sensor.name} in ${
              sensor.building
            } marked as unknown due to timeout (${timeSinceLastUpdate.toFixed(
              0
            )}s since last update)`,
            system: "backend:sensorTimeoutMonitor",
          });
        }
      } else {
        // Sensor is still active - log recovery if it was previously unknown
        if (sensor.state === "unknown") {
          console.log(
            `Sensor ${sensor.name} in ${sensor.building} recovered from unknown state`
          );
          await raiseEvent({
            type: "info",
            message: `Sensor ${sensor.name} in ${sensor.building} recovered from unknown state`,
            system: "backend:sensorTimeoutMonitor",
          });
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
   * Get the number of active intervals.
   *
   * @returns {number} The current number of sensor intervals being monitored
   *
   * @example
   * ```typescript
   * const activeCount = sensorTimeoutMonitor.getActiveIntervalCount();
   * console.log(`Monitoring ${activeCount} sensors`);
   * ```
   */
  getActiveIntervalCount(): number {
    return this.intervalIds.length;
  }

  /**
   * Get all active interval IDs.
   *
   * Returns a copy of the interval IDs array for debugging/testing purposes.
   * The returned array is a copy to prevent external modification.
   *
   * @returns {NodeJS.Timeout[]} Array of all current interval IDs
   *
   * @example
   * ```typescript
   * const intervalIds = sensorTimeoutMonitor.getIntervalIds();
   * console.log(`Active intervals: ${intervalIds.length}`);
   * ```
   */
  getIntervalIds(): NodeJS.Timeout[] {
    return [...this.intervalIds]; // Return copy to prevent external modification
  }
}

/**
 * Singleton instance of the SensorTimeoutMonitor for use across the application.
 *
 * This instance is shared across all modules that need to interact with
 * the sensor timeout monitoring system.
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
