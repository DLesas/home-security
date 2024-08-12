// TODO: finish off notification system
import { Expo } from "expo-server-sdk";
import { db } from "./db/db";
import { eventLogsTable, type insertEventLog } from "./db/schema/eventLogs";
import { type Config, configRepository } from "./redis/config";
import { raiseError } from "./errorHandling";

let expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
  useFcmV1: false, // this can be set to true in order to use the FCM v1 API
});

export function raiseWarningNotification() {
  console.log("warning");
}

export async function raiseCriticalNotification() {
  let messages = [];
  const config = await configRepository.search().returnFirst() as Config | null;
  if (config === null) {
    console.error("No config found");
    raiseError();
    return;
  }
  for (let pushToken of config.pushTokens) {
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Push token ${pushToken} is not a valid Expo push token`);
      continue;
    }
  }
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
