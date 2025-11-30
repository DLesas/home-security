/**
 * RestartTracker manages the entire restart lifecycle for a camera stream.
 *
 * Owns all timing, scheduling, and attempt tracking. StreamManager just
 * provides a restart callback and tells RestartTracker when attention is needed.
 *
 * Usage:
 *   const tracker = new RestartTracker({
 *     cameraName: "Front Door",
 *     cameraId: "abc123",
 *     onRestart: async () => {
 *       // StreamManager performs the actual restart here
 *       await this.restartCamera(cameraId);
 *     },
 *   });
 *
 *   // When frames stop flowing:
 *   tracker.requestRestart();
 *
 *   // When frames are flowing again:
 *   tracker.markHealthy();
 *
 *   // On camera removal:
 *   tracker.dispose();
 */

import { raiseEvent } from "../shared/events/notify";

export interface RestartTrackerConfig {
  /** Camera ID (for future use) */
  cameraId: string;
  /** Camera name for logging/events */
  cameraName: string;
  /** Callback to perform the actual restart */
  onRestart: () => Promise<void>;
  /** Interval between retry attempts in ms (default: 60000 = 60s) */
  retryIntervalMs?: number;
}

const DEFAULT_RETRY_INTERVAL_MS = 60000;

export class RestartTracker {
  private readonly cameraName: string;
  private readonly onRestart: () => Promise<void>;
  private readonly retryIntervalMs: number;

  private retryTimer: NodeJS.Timeout | null = null;
  private isRestarting: boolean = false;
  private attemptCount: number = 0;
  private isDisposed: boolean = false;

  constructor(config: RestartTrackerConfig) {
    this.cameraName = config.cameraName;
    this.onRestart = config.onRestart;
    this.retryIntervalMs = config.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS;
  }

  /**
   * Request a restart. RestartTracker handles all timing.
   *
   * - If not currently retrying, starts a restart immediately
   * - If already retrying, this is a no-op (restart is already scheduled)
   */
  requestRestart(): void {
    if (this.isDisposed) return;

    if (this.isRestarting) {
      console.log(`[RestartTracker] ${this.cameraName}: Already retrying, skipping duplicate request`);
      return;
    }

    console.log(`[RestartTracker] ${this.cameraName}: Restart requested`);
    this.executeRestart();
  }

  /**
   * Signal that the camera is healthy (frames flowing).
   * Resets attempt count and cancels any pending retry.
   */
  markHealthy(): void {
    if (this.isDisposed) return;

    if (this.attemptCount > 0 || this.retryTimer) {
      console.log(`[RestartTracker] ${this.cameraName}: Marked healthy, resetting`);
    }

    this.cancelPendingRetry();
    this.attemptCount = 0;
    this.isRestarting = false;
  }

  /**
   * Get current state for debugging/stats
   */
  getState(): { isRetrying: boolean; attemptCount: number } {
    return {
      isRetrying: this.isRestarting,
      attemptCount: this.attemptCount,
    };
  }

  /**
   * Clean up timers and prevent further restarts
   */
  dispose(): void {
    this.isDisposed = true;
    this.cancelPendingRetry();
  }

  /**
   * Execute a restart attempt
   */
  private async executeRestart(): Promise<void> {
    if (this.isDisposed) return;

    this.isRestarting = true;
    this.attemptCount++;

    await this.raiseRestartEvent();

    try {
      console.log(`[RestartTracker] ${this.cameraName}: Executing restart...`);
      await this.onRestart();

      // If onRestart didn't throw, the restart succeeded
      // Don't reset here - wait for markHealthy() to be called when frames flow
      console.log(`[RestartTracker] ${this.cameraName}: Restart callback completed`);
    } catch (error) {
      console.error(`[RestartTracker] ${this.cameraName}: Restart failed:`, error);

      // Schedule next retry
      this.scheduleRetry();
    }
  }

  /**
   * Schedule the next retry attempt
   */
  private scheduleRetry(): void {
    if (this.isDisposed) return;

    this.cancelPendingRetry();

    console.log(
      `[RestartTracker] ${this.cameraName}: Scheduling retry in ${this.retryIntervalMs / 1000}s`
    );

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.executeRestart();
    }, this.retryIntervalMs);
  }

  /**
   * Cancel any pending retry timer
   */
  private cancelPendingRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Raise an event for the restart attempt
   */
  private async raiseRestartEvent(): Promise<void> {
    const message = `Camera "${this.cameraName}" restarting (attempt ${this.attemptCount})`;

    console.log(`[RestartTracker] ${message}`);
    await raiseEvent({
      type: "warning",
      message,
      system: "cameraIngestion:restartTracker",
    });
  }
}
