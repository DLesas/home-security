import { publishEvent, type Event, type EventTitle } from '../shared/events/notify';

/**
 * Simplified event raising for cameraIngestion service
 * Only publishes to Redis (event-system handles database logging)
 */
export async function raiseEvent(event: Event): Promise<void> {
  try {
    const title: EventTitle = event.title || `${event.type} System Event` as unknown as EventTitle;

    await publishEvent({
      type: event.type,
      message: event.message,
      system: event.system,
      title
    });

    console.log(`[Events] Published ${event.type}: ${event.message}`);
  } catch (error) {
    console.error('[Events] Failed to publish event:', error);
  }
}
