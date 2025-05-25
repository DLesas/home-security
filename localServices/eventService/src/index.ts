import { EventConsumer } from "./eventConsumer";
import { type FormattedEvent } from "./shared/events/events";
import { sendSMS, numbers, sendEmailSES } from "./Dummy-publish";

async function main() {
  const consumer = new EventConsumer();

  // Set up event handlers
  consumer.on("event", async (event: FormattedEvent) => {
    if (event.data.type === "critical") {
      for (const person of numbers) {
        await sendSMS(person.number, event.data.message, event.data.title);
      }
    } else if (event.data.type === "warning") {
      for (const person of numbers) {
        await sendEmailSES(person.email, event.data.title, event.data.message);
      }
    }
  });

  consumer.on("error", async (error) => {
    console.error("Consumer error:", error);
  });

  // Start the consumer
  await consumer.start();

  // Your other application logic can continue here
  // The event handling happens asynchronously
}

main();
