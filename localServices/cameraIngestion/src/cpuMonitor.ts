import os from "os";

/**
 * CPU Monitor for tracking system CPU usage
 * Used to enable adaptive JPEG quality based on system load
 */
export class CPUMonitor {
  private previousCPUTimes: NodeJS.CpuUsage | null = null;
  private currentUsagePercent: number = 0;
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor(private updateIntervalMs: number = 1000) {}

  /**
   * Start monitoring CPU usage
   */
  start(): void {
    if (this.monitorInterval) {
      console.warn("[CPUMonitor] Already running");
      return;
    }

    console.log("[CPUMonitor] Starting CPU monitoring...");
    this.previousCPUTimes = process.cpuUsage();

    this.monitorInterval = setInterval(() => {
      this.updateCPUUsage();
    }, this.updateIntervalMs);
  }

  /**
   * Stop monitoring CPU usage
   */
  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      console.log("[CPUMonitor] Stopped");
    }
  }

  /**
   * Get current CPU usage as percentage (0-100)
   */
  getCPUUsage(): number {
    return this.currentUsagePercent;
  }

  /**
   * Update CPU usage calculation
   */
  private updateCPUUsage(): void {
    if (!this.previousCPUTimes) {
      this.previousCPUTimes = process.cpuUsage();
      return;
    }

    const currentCPUTimes = process.cpuUsage(this.previousCPUTimes);

    // Calculate CPU usage percentage
    // cpuUsage returns microseconds, so divide by 1000 to get milliseconds
    const userTime = currentCPUTimes.user / 1000;
    const systemTime = currentCPUTimes.system / 1000;
    const totalTime = userTime + systemTime;

    // Calculate percentage based on elapsed time and number of CPUs
    const elapsedTime = this.updateIntervalMs;
    const numCPUs = os.cpus().length;

    // CPU usage as percentage (0-100)
    this.currentUsagePercent = Math.min(
      100,
      (totalTime / (elapsedTime * numCPUs)) * 100
    );

    this.previousCPUTimes = process.cpuUsage();
  }

  /**
   * Get system information
   */
  getSystemInfo(): {
    totalMemory: number;
    freeMemory: number;
    memoryUsagePercent: number;
    cpuCount: number;
    platform: string;
  } {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      totalMemory: Math.round(totalMemory / 1024 / 1024), // MB
      freeMemory: Math.round(freeMemory / 1024 / 1024), // MB
      memoryUsagePercent: (usedMemory / totalMemory) * 100,
      cpuCount: os.cpus().length,
      platform: os.platform(),
    };
  }
}

// Global singleton instance
export const cpuMonitor = new CPUMonitor();
