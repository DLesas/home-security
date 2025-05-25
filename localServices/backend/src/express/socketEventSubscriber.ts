import { redis } from "../redis";
import { io } from "../index";
import { type FormattedEvent } from "../events/events";

const EVENTS_CHANNEL = process.env.EVENTS_CHANNEL!;

/**
 * Socket Event Subscriber that handles real-time events from Redis pub/sub
 * and emits them to Socket.IO clients
 */
export class SocketEventSubscriber {
  private subscriber;
  private isConnected = false;

  constructor() {
    this.subscriber = redis.duplicate();
  }

  /**
   * Starts the socket event subscriber
   * @returns Promise<void>
   */
  async start(): Promise<void> {
    if (this.isConnected) return;

    try {
      await this.subscriber.connect();
      this.isConnected = true;

      await this.subscriber.subscribe(EVENTS_CHANNEL, async (message) => {
        try {
          const event: FormattedEvent = JSON.parse(message);

          // Emit the event to all connected Socket.IO clients
          io.emit("event", event);

          console.log("Event emitted to Socket.IO clients:", event.data.title);
        } catch (error) {
          console.error("Error processing event for Socket.IO:", error);
        }
      });

      console.log("Socket Event Subscriber started successfully");
    } catch (error) {
      console.error("Failed to start Socket Event Subscriber:", error);
      throw error;
    }
  }

  /**
   * Stops the socket event subscriber
   * @returns Promise<void>
   */
  async stop(): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.subscriber.unsubscribe(EVENTS_CHANNEL);
      await this.subscriber.quit();
      this.isConnected = false;
      console.log("Socket Event Subscriber stopped successfully");
    } catch (error) {
      console.error("Error stopping Socket Event Subscriber:", error);
      throw error;
    }
  }
}
