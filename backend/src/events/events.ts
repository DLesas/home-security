import { redis } from "../redis/index";
import { insertEventLog } from "../db/schema/eventLogs";


const EVENTS_CHANNEL = process.env.EVENTS_CHANNEL!;

/**
 * Publishes an event to Redis pub/sub
 * @param event - The event to publish
 * @returns Promise<void>
 */
export async function publishEvent(event: insertEventLog): Promise<void> {
  try {
    await redis.publish(EVENTS_CHANNEL, JSON.stringify(event));
    console.log(`${event.type} Event published`);
  } catch (error) {
    console.error("Failed to publish event:", error);
    throw error;
  }
}