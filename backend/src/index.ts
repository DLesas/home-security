// Import the 'express' module
import { EntityId } from "redis-om";
import {
  type doorSensorState,
  doorSensorStateRepository,
} from "./redis/doorSensorState";
import { type DoorSensor, doorSensorsRepository } from "./redis/doorSensor";
import express, { Request, Response } from "express";
import http from "http";
import { Server } from "socket.io";
import { db } from "./db/db";
import { generalLogsTable } from "./db/schema/generalLogs";
import {
  eventLogsTable,
  type insertEventLog,
  type selectEventLog,
} from "./db/schema/eventLogs";
import { configRepository } from "./redis/config";
import { type Alarm, alarmRepository } from "./redis/alarms";
import { raiseCriticalNotification, raiseWarningNotification } from "./notifiy";

// Create an Express application
const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server);
const port = 8080;

io.on("connection", (socket) => {
  console.log("a user connected");
});

app.get("/", (req: Request, res: Response) => {
  res.send("Hello, TypeScript + Node.js + Express!");
});

app.post("/api/v1/logs", async (req, res) => {
  const { state, temperature }: {
    state: "open" | "closed";
    temperature: number;
  } = req.body;
  const clientIp = req.ip!;
  await db.insert(generalLogsTable).values({
    endpoint: "api/v1/logs",
    action: "post",
    connection: "http",
    clientIp,
    userAgent: req.headers["user-agent"],
  });
});

app.get("/api/v1/state", async (req, res) => {
  const snesorStates = await doorSensorStateRepository.search().returnAll();
  res.send(snesorStates);
});

// Start the server and listen on the specified port
server.listen(port, () => {
  // Log a message when the server is successfully running
  console.log(`Server is running on http://localhost:${port}`);
});

async function DoorSensorUpdate(
  { state, temperature, ip }: {
    state: "open" | "closed";
    temperature: number;
    ip: string;
  },
) {
  const sensor = await doorSensorsRepository.search().where("ipAddress").eq(
    ip,
  ).returnFirst() as DoorSensor;
  const currentState = await doorSensorStateRepository.search().where(
    "ipAddress",
  ).eq(ip).returnFirst() as doorSensorState || null;
  if (currentState === null) {
    return {
      type: "error",
      message: "",
    };
  }
  currentState.state = state;
  const config = await configRepository.search().returnFirst();
  await doorSensorStateRepository.save(currentState);
  if (currentState && currentState.armed && state === "open") {
    const alarms = await alarmRepository.search().returnAll() as Alarm[];
    const res = await changeAlarmState(alarms, "on");
    raiseEvent(
      "critical",
      `Alarm triggered by sensor ${sensor.name} at ${sensor.building} with ip address of ${sensor.ipAddress}`,
    );
  }
}

async function changeAlarmState(alarms: Alarm[], state: "on" | "off") {
  const promises = [];
  for (let index = 0; index < alarms.length; index++) {
    const element = alarms[index];
    element.playing = state === "on" ? true : false;
    promises.push(alarmRepository.save(element));
    promises.push(
      fetch(state === "on" ? element.onAddress : element.offAddress),
    );
  }
  const results = await Promise.all(promises);
  return results;
}

async function raiseEvent(
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
