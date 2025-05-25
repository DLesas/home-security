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

/**
 * Publishes an event to Redis pub/sub
 * @param event - The event to publish
 * @returns Promise<void>
 */
export async function publishEvent(event: Event & { title: EventTitle }): Promise<void> {
  try {
    const eventFormatted: FormattedEvent = {
      timestamp: Date.now(),
      data: event,
    };
    await redis.publish(EVENTS_CHANNEL, JSON.stringify(eventFormatted));
    console.log(`${event.type} Event published`);
  } catch (error) {
    console.error("Failed to publish event:", error);
    throw error;
  }
}
