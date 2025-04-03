import { EventConsumer, SystemEvent } from "./eventConsumer";

async function main() {
  const consumer = new EventConsumer();

  // Set up event handlers
  consumer.on("event", async (event: SystemEvent) => {
    try {
      switch (event.eventType) {
        case "MOTION_DETECTED":
          await handleMotionDetection(event);
          break;
        case "DOOR_OPENED":
          await handleDoorEvent(event);
          break;
        // Add other event types
        default:
          console.log("Unhandled event type:", event.eventType);
      }
    } catch (error) {
      console.error("Error handling event:", error);
    }
  });

  consumer.on("error", (error) => {
    console.error("Consumer error:", error);
  });

  // Start the consumer
  await consumer.start();

  // Your other application logic can continue here
  // The event handling happens asynchronously
}

async function handleMotionDetection(event: SystemEvent) {
  console.log("Motion detected:", event.data);
  // Handle motion detection
}

async function handleDoorEvent(event: SystemEvent) {
  console.log("Door event:", event.data);
  // Handle door event
}

main().catch(console.error);
