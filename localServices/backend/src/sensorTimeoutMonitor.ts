import { doorSensorRepository, type doorSensor } from "./redis/doorSensors";
import { raiseEvent } from "./events/notify";

/**
 * Monitor sensor timeouts and mark sensors as "unknown" if they haven't
 * checked in within their expectedSecondsUpdated timeframe.
 */
export class SensorTimeoutMonitor {
  private intervalIds: NodeJS.Timeout[] = [];
  private isRunningFlag: boolean = false;

  constructor() {
  }

  /**
   * Start the timeout monitoring service
   * Creates individual intervals for each sensor based on their expectedSecondsUpdated
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
   * Stop the timeout monitoring service
   * Clears all interval timers and cleans up resources
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
   * Recreate all sensor intervals
   * Clears existing intervals and creates new ones for all sensors
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
   * Create individual intervals for all sensors
   * Each sensor gets its own interval based on its expectedSecondsUpdated value
   */
  private async createAllSensorIntervals(): Promise<void> {
    try {
      // Fetch all sensors from Redis
      const sensors = (await doorSensorRepository.search().return.all()) as doorSensor[];

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
   * Create an individual interval for a specific sensor
   * The interval runs every expectedSecondsUpdated seconds and checks the sensor's lastUpdated
   */
  private createSensorInterval(sensor: doorSensor): void {
    const intervalMs = sensor.expectedSecondsUpdated * 1000; // Convert seconds to milliseconds

    const intervalId = setInterval(async () => {
      await this.checkSensorTimeout(sensor);
    }, intervalMs);
    this.intervalIds.push(intervalId);
  }

  /**
   * Check if a specific sensor has timed out
   * Compares current time vs lastUpdated and marks as unknown if timed out
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

          // Raise warning event
          await raiseEvent({
            type: "warning",
            message: `Sensor ${
              sensor.name
            } in ${sensor.building} marked as unknown due to timeout (${timeSinceLastUpdate.toFixed(
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
   * Get monitoring status
   * Returns whether the monitor is currently running
   */
  isRunning(): boolean {
    return this.isRunningFlag;
  }

  /**
   * Get the number of active intervals
   * Returns the current number of sensor intervals being monitored
   */
  getActiveIntervalCount(): number {
    return this.intervalIds.length;
  }

  /**
   * Get all active interval IDs
   * Returns array of all current interval IDs (for debugging/testing)
   */
  getIntervalIds(): NodeJS.Timeout[] {
    return [...this.intervalIds]; // Return copy to prevent external modification
  }
}

// Export a singleton instance for use across the application
export const sensorTimeoutMonitor = new SensorTimeoutMonitor();
