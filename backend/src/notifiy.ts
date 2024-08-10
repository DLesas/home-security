// TODO: finish off notification system

import { db } from "./db/db";
import { eventLogsTable, type insertEventLog } from "./db/schema/eventLogs";

export function raiseWarningNotification() {
  console.log("warning");
}

export function raiseCriticalNotification() {
  console.log("critical");
}
export async function raiseEvent(
  type: insertEventLog["type"],
  message: insertEventLog["message"],
) {
  await db.insert(eventLogsTable).values({
    type: type,
    message: message,
  });
  switch (type) {
    case "critical":
      raiseCriticalNotification();
      break;
    case "warning":
      raiseWarningNotification();
      break;
    default:
      break;
  }
}
