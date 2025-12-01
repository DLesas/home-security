/**
 * RollingAverage - Utility class for tracking rolling window averages
 *
 * Used for performance metrics (frame processing, decode timing, encode timing, etc.)
 * Maintains a fixed-size window of recent values and provides average calculations.
 */
export class RollingAverage {
  private values: number[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Add a value to the rolling window
   * Automatically removes oldest value if window is full
   */
  add(value: number): void {
    this.values.push(value);
    if (this.values.length > this.maxSize) {
      this.values.shift();
    }
  }

  /**
   * Get the average of all values in the window
   * Returns 0 if no values have been added
   */
  getAverage(): number {
    if (this.values.length === 0) return 0;
    return this.values.reduce((a, b) => a + b, 0) / this.values.length;
  }

  /**
   * Get the number of values currently in the window
   */
  getCount(): number {
    return this.values.length;
  }

  /**
   * Get the sum of all values in the window
   */
  getSum(): number {
    return this.values.reduce((a, b) => a + b, 0);
  }

  /**
   * Get a slice of recent values (for FPS calculations etc.)
   */
  getRecent(count: number): number[] {
    return this.values.slice(-count);
  }

  /**
   * Clear all values from the window
   */
  clear(): void {
    this.values = [];
  }
}
