import { db } from "../db/db";
import { eventLogsTable, type insertEventLog } from "../db/schema/eventLogs";
import { publishEvent } from "./events";

export type alarmEvent =
  | `Alarm Triggered: ${string} in ${string}`
  | `Alarm Deactivated`;
// | `Alarm Added: ${string} in ${string}`
// | `Alarm Deleted: ${string} in ${string}`;

export type sensorEvent =
  | `Sensor Armed: ${string} in ${string}`
  | `Sensor Disarmed: ${string} in ${string}`
  | `Sensor Deleted: ${string} in ${string}`
  | `Sensor Added: ${string} in ${string}`;

export type buildingEvent =
  | `Building Armed: ${string}`
  | `Building Disarmed: ${string}`
  | `Building Added: ${string}`
  | `Building Deleted: ${string}`;

export type doorEvent =
  | `Door Opened: ${string} in ${string}`
  | `Door Closed: ${string} in ${string}`;

export type EventTitle =
  | sensorEvent
  | doorEvent
  | buildingEvent
  | alarmEvent
  | "warning System Event"
  | "critical System Event"
  | "info System Event"
  | "debug System Event";

export interface Event {
  type: insertEventLog["type"];
  message: insertEventLog["message"];
  system: insertEventLog["system"];
  title?: EventTitle;
}

export async function raiseEvent(event: Event) {
  await db.insert(eventLogsTable).values({
    type: event.type,
    message: event.message,
    system: event.system,
  });
  if (event.type === "warning" || event.type === "critical" || event.title) {
    event.title = event.title ? event.title : `${event.type} System Event` as unknown as EventTitle;
    await publishEvent({
      type: event.type,
      message: event.message,
      system: event.system,
      title: event.title,
    });
  }
}

export class CustomError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "CustomError";
  }
}

export function raiseError(statusCode: number, message: string): CustomError {
  const err = new CustomError(statusCode, message);
  console.error(err);
  return err;
}
