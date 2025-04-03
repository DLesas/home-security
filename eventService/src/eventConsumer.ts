import { createClient } from "redis";
import EventEmitter from "events";
import { redis } from "./shared/redis";
/**
 * Represents the structure of a system event
 */
export interface SystemEvent {
  eventType: string;
  source: string;
  timestamp: number;
  data: Record<string, any>;
}

/**
 * Event consumer that handles real-time events using Redis pub/sub
 */
export class EventConsumer extends EventEmitter {
  private redis;
  private subscriber;
  private readonly CHANNEL = process.env.EVENTS_CHANNEL!;
  private isConnected = false;

  constructor() {
    super();
    this.redis = redis;
    this.subscriber = this.redis.duplicate();
  }

  /**
   * Starts the event consumer
   * @returns Promise<void>
   */
  async start(): Promise<void> {
    if (this.isConnected) return;

    try {
      // Connect both clients
      await this.redis.connect();
      await this.subscriber.connect();
      this.isConnected = true;

      // Subscribe to the channel
      await this.subscriber.subscribe(this.CHANNEL, (message) => {
        try {
          const event: SystemEvent = JSON.parse(message);
          this.emit("event", event);
        } catch (error) {
          console.error("Error processing event:", error);
          this.emit("error", error);
        }
      });

      console.log("Event consumer started successfully");
    } catch (error) {
      console.error("Failed to start event consumer:", error);
      throw error;
    }
  }

  /**
   * Stops the event consumer
   * @returns Promise<void>
   */
  async stop(): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.subscriber.unsubscribe(this.CHANNEL);
      await this.subscriber.quit();
      await this.redis.quit();
      this.isConnected = false;
      console.log("Event consumer stopped successfully");
    } catch (error) {
      console.error("Error stopping event consumer:", error);
      throw error;
    }
  }
}
