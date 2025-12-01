import { redis } from "../redis/index";
import { insertEventLog } from "../db/schema/eventLogs";
import { type Event, type EventTitle } from "./notify";

/**
 * Represents the structure of a system event
 */

export type FormattedEvent = {
  timestamp: number;
  data: Event & { title: EventTitle };
};

const EVENTS_CHANNEL = process.env.EVENTS_CHANNEL!;

// Queue for events when Redis is unavailable
const eventQueue: FormattedEvent[] = [];
const MAX_QUEUE_SIZE = 1000; // Prevent unbounded memory growth

/**
 * Flush queued events to Redis
 */
async function flushEventQueue(): Promise<void> {
  if (eventQueue.length === 0) return;

  console.log(`Flushing ${eventQueue.length} queued event(s) to Redis...`);

  while (eventQueue.length > 0) {
    const event = eventQueue.shift();
    if (event) {
      try {
        await redis.publish(EVENTS_CHANNEL, JSON.stringify(event));
        console.log(`Queued ${event.data.type} event published`);
      } catch (error) {
        // Put it back at the front and stop flushing
        eventQueue.unshift(event);
        console.error("Failed to flush event, will retry later:", error);
        break;
      }
    }
  }
}

// Listen for Redis reconnection to flush queue
redis.on("ready", () => {
  flushEventQueue().catch((error) => {
    console.error("Error flushing event queue:", error);
  });
});

/**
 * Add an event to the queue
 */
function queueEvent(event: FormattedEvent): void {
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    // Remove oldest event to make room
    const dropped = eventQueue.shift();
    console.warn(`Event queue full, dropping oldest event: ${dropped?.data.type}`);
  }
  eventQueue.push(event);
  console.log(`Event queued (queue size: ${eventQueue.length})`);
}

/**
 * Publishes an event to Redis pub/sub
 * Queues the event if Redis is unavailable
 * @param event - The event to publish
 * @returns Promise<void>
 */
export async function publishEvent(event: Event & { title: EventTitle }): Promise<void> {
  const eventFormatted: FormattedEvent = {
    timestamp: Date.now(),
    data: event,
  };

  try {
    // Check if Redis is connected
    if (!redis.isOpen) {
      queueEvent(eventFormatted);
      return;
    }

    await redis.publish(EVENTS_CHANNEL, JSON.stringify(eventFormatted));
    console.log(`${event.type} Event published`);
  } catch (error) {
    console.error("Failed to publish event, queuing:", error);
    queueEvent(eventFormatted);
  }
}
