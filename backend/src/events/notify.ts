import { db } from "../db/db";
import { eventLogsTable, type insertEventLog } from "../db/schema/eventLogs";
import { publishEvent } from "./events";


export async function raiseEvent(
  type: insertEventLog["type"],
  message: insertEventLog["message"],
  system: insertEventLog["system"]
) {
  await db.insert(eventLogsTable).values({
    type: type,
    message: message,
    system: system,
  });
  await publishEvent({
    type: type,
    message: message,
    system: system,
  });
}


export class CustomError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "CustomError";
  }
}

export function raiseError(statusCode: number, message: string) {
  const err = new CustomError(statusCode, message);
  console.error(err);
  return err;
}
