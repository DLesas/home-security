import { type Alarm, alarmRepository } from "./redis/alarms";
import { raiseEvent } from "./events/notify";

// Type for the callback function that handles alarm state changes
type AlarmStateChangeCallback = (
  alarms: Alarm[],
  state: "on" | "off"
) => Promise<Boolean[]>;

/**
 * Singleton class for managing individual alarm timeouts.
 *
 * This class manages automatic alarm turn-off functionality where each alarm
 * can have its own timeout duration. When an alarm is turned on, it will
 * automatically turn off after its configured `autoTurnOffSeconds` duration.
 *
 * Key features:
 * - Individual timeout settings per alarm (stored in alarm.autoTurnOffSeconds)
 * - In-memory timeout tracking with automatic cleanup
 * - Automatic cleanup when alarms are manually turned off
 *
 * @example
 * ```typescript
 * // Initialize the manager with callback and start it
 * import { changeAlarmState } from './alarmFuncs';
 * alarmTimeoutManager.setAlarmStateChangeCallback(changeAlarmState);
 * await alarmTimeoutManager.start();
 *
 * // Or use the helper function
 * import { initializeAlarmTimeoutManager } from './alarmFuncs';
 * await initializeAlarmTimeoutManager();
 *
 * // Set a timeout for an alarm when it's turned on
 * await alarmTimeoutManager.setAlarmTimeout(alarm);
 *
 * // Clear timeout when alarm is manually turned off
 * alarmTimeoutManager.clearAlarmTimeout(alarm.externalID);
 *
 * // Check if alarm has active timeout
 * if (alarmTimeoutManager.isTimeoutActive(alarm.externalID)) {
 *   console.log("Alarm will auto-turn off");
 * }
 * ```
 */
export class AlarmTimeoutManager {
  /** In-memory storage for timeout IDs since they don't serialize to Redis */
  private alarmTimeouts = new Map<string, NodeJS.Timeout>();
  /** Flag indicating whether the manager is currently running */
  private isRunningFlag: boolean = false;
  /** Callback function to handle alarm state changes */
  private alarmStateChangeCallback?: AlarmStateChangeCallback;

  constructor() {
    // No initialization needed - manager starts in stopped state
  }

  /**
   * Set the callback function for handling alarm state changes.
   * This must be called before start() to enable automatic alarm turn-off.
   *
   * @param {AlarmStateChangeCallback} callback - Function to call when alarms need to be turned off
   *
   * @example
   * ```typescript
   * import { changeAlarmState } from './alarmFuncs';
   * alarmTimeoutManager.setAlarmStateChangeCallback(changeAlarmState);
   * ```
   */
  setAlarmStateChangeCallback(callback: AlarmStateChangeCallback): void {
    this.alarmStateChangeCallback = callback;
  }

  /**
   * Start the alarm timeout management service.
   *
   * Initializes the manager for handling new timeout requests.
   *
   * @returns {Promise<void>} Resolves when the manager has started successfully
   *
   * @example
   * ```typescript
   * await alarmTimeoutManager.start();
   * console.log("Alarm timeout management started");
   * ```
   */
  async start(): Promise<void> {
    if (this.isRunningFlag) {
      console.warn("AlarmTimeoutManager is already running");
      return;
    }

    console.log("Starting alarm timeout management...");
    this.isRunningFlag = true;

    console.log("AlarmTimeoutManager started successfully");
  }

  /**
   * Stop the alarm timeout management service.
   *
   * Clears all active timeouts and cleans up resources. This method is
   * safe to call multiple times - subsequent calls will be ignored.
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * alarmTimeoutManager.stop();
   * console.log("Alarm timeout management stopped");
   * ```
   */
  stop(): void {
    if (!this.isRunningFlag) {
      console.warn("AlarmTimeoutManager is not running");
      return;
    }

    console.log("Stopping alarm timeout management...");

    // Clear all timeout timers
    this.alarmTimeouts.forEach((timeoutId, alarmId) => {
      clearTimeout(timeoutId);
      console.log(`[TIMEOUT] Cleared timeout for alarm ${alarmId}`);
    });
    this.alarmTimeouts.clear();

    this.isRunningFlag = false;
    console.log("AlarmTimeoutManager stopped");
  }

  /**
   * Set an auto-timeout for an alarm to turn it off automatically.
   *
   * Uses the alarm's individual `autoTurnOffSeconds` setting to determine
   * the timeout duration. If the alarm has no timeout configured (0 or undefined),
   * no timeout will be set.
   *
   * @param {Alarm} alarm - The alarm to set timeout for
   * @returns {Promise<void>} Resolves when the timeout has been set
   *
   * @example
   * ```typescript
   * // Alarm with 5 minute timeout
   * alarm.autoTurnOffSeconds = 300;
   * await alarmTimeoutManager.setAlarmTimeout(alarm);
   * ```
   */
  async setAlarmTimeout(alarm: Alarm): Promise<void> {
    try {
      // Check if alarm has a timeout setting configured
      if (!alarm.autoTurnOffSeconds || alarm.autoTurnOffSeconds <= 0) {
        console.log(
          `[TIMEOUT] Alarm ${alarm.name} has no timeout configured (autoTurnOffSeconds: ${alarm.autoTurnOffSeconds})`
        );
        return;
      }

      const timeoutMs = alarm.autoTurnOffSeconds * 1000;

      // Clear any existing timeout first
      this.clearAlarmTimeout(alarm.externalID);

      // Set the timeout
      const timeoutId = setTimeout(async () => {
        console.log(
          `[TIMEOUT] Auto-turning off alarm ${alarm.name} after ${alarm.autoTurnOffSeconds}s`
        );
        try {
          // Turn off the alarm automatically using the callback
          if (this.alarmStateChangeCallback) {
            await this.alarmStateChangeCallback([alarm], "off");
          } else {
            console.warn(
              `[TIMEOUT] No alarm state change callback set - cannot auto-turn off alarm ${alarm.name}`
            );
          }
          // Remove from timeout map
          this.alarmTimeouts.delete(alarm.externalID);

          // Raise info event
          await raiseEvent({
            type: "warning",
            message: `Alarm ${alarm.name} in ${alarm.building} automatically turned off after ${alarm.autoTurnOffSeconds}s timeout`,
            system: "backend:alarmTimeoutManager",
          });
        } catch (error) {
          console.error(
            `[TIMEOUT] Failed to auto-turn off alarm ${alarm.name}:`,
            error
          );
          await raiseEvent({
            type: "critical",
            message: `Failed to auto-turn off alarm ${alarm.name}: ${error}`,
            system: "backend:alarmTimeoutManager",
          });
        }
      }, timeoutMs);

      // Store the timeout ID
      this.alarmTimeouts.set(alarm.externalID, timeoutId);

      console.log(
        `[TIMEOUT] Alarm ${alarm.name} will auto-turn off in ${alarm.autoTurnOffSeconds}s`
      );
    } catch (error) {
      console.error(
        `[TIMEOUT] Failed to set auto-timeout for alarm ${alarm.name}:`,
        error
      );
      await raiseEvent({
        type: "critical",
        message: `Failed to set auto-timeout for alarm ${alarm.name}: ${error}`,
        system: "backend:alarmTimeoutManager",
      });
    }
  }

  /**
   * Clear the auto-timeout for an alarm if one exists.
   *
   * This is called when an alarm is manually turned off to prevent
   * the auto-timeout from firing unnecessarily.
   *
   * @param {string} alarmId - The external ID of the alarm
   * @returns {void}
   *
   * @example
   * ```typescript
   * alarmTimeoutManager.clearAlarmTimeout(alarm.externalID);
   * ```
   */
  clearAlarmTimeout(alarmId: string): void {
    const timeoutId = this.alarmTimeouts.get(alarmId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.alarmTimeouts.delete(alarmId);
      console.log(`[TIMEOUT] Cleared auto-timeout for alarm ${alarmId}`);
    }
  }

  /**
   * Check if a specific alarm has an active timeout.
   *
   * @param {string} alarmId - The external ID of the alarm
   * @returns {boolean} `true` if the alarm has an active timeout, `false` otherwise
   *
   * @example
   * ```typescript
   * if (alarmTimeoutManager.isTimeoutActive(alarm.externalID)) {
   *   console.log("Alarm will auto-turn off");
   * }
   * ```
   */
  isTimeoutActive(alarmId: string): boolean {
    return this.alarmTimeouts.has(alarmId);
  }

  /**
   * Get the current running status.
   *
   * @returns {boolean} `true` if the manager is currently running, `false` otherwise
   *
   * @example
   * ```typescript
   * if (alarmTimeoutManager.isRunning()) {
   *   console.log("Manager is active");
   * }
   * ```
   */
  isRunning(): boolean {
    return this.isRunningFlag;
  }

  /**
   * Get the number of active alarm timeouts.
   *
   * @returns {number} The current number of alarm timeouts being managed
   *
   * @example
   * ```typescript
   * const activeCount = alarmTimeoutManager.getActiveTimeoutCount();
   * console.log(`Managing ${activeCount} alarm timeouts`);
   * ```
   */
  getActiveTimeoutCount(): number {
    return this.alarmTimeouts.size;
  }

  /**
   * Get all active alarm IDs that have timeouts.
   *
   * Returns a copy of the alarm IDs array for debugging/testing purposes.
   * The returned array is a copy to prevent external modification.
   *
   * @returns {string[]} Array of all alarm IDs with active timeouts
   *
   * @example
   * ```typescript
   * const activeAlarmIds = alarmTimeoutManager.getActiveTimeoutAlarmIds();
   * console.log(`Alarms with timeouts: ${activeAlarmIds.join(', ')}`);
   * ```
   */
  getActiveTimeoutAlarmIds(): string[] {
    return Array.from(this.alarmTimeouts.keys());
  }
}

/**
 * Singleton instance of the AlarmTimeoutManager for use across the application.
 *
 * This instance is shared across all modules that need to interact with
 * the alarm timeout management system.
 *
 * @example
 * ```typescript
 * import { initializeAlarmTimeoutManager } from './alarmFuncs';
 *
 * // Initialize and start timeout management
 * await initializeAlarmTimeoutManager();
 *
 * // Or manually
 * import { alarmTimeoutManager } from './alarmTimeoutManager';
 * import { changeAlarmState } from './alarmFuncs';
 * alarmTimeoutManager.setAlarmStateChangeCallback(changeAlarmState);
 * await alarmTimeoutManager.start();
 * ```
 */
export const alarmTimeoutManager = new AlarmTimeoutManager();
