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
import { accessLogsTable } from "./db/schema/accessLogs";
import {
  eventLogsTable,
  type insertEventLog,
  type selectEventLog,
} from "./db/schema/eventLogs";
import { type Config, configRepository } from "./redis/config";
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
  await db.insert(accessLogsTable).values({
    endpoint: "api/v1/logs",
    action: "post",
    connection: "http",
    clientIp,
    userAgent: req.headers["user-agent"],
  });
  await DoorSensorUpdate({ state, temperature, ip: clientIp });
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
    state: "open" | "closed" | "unknown";
    temperature: number;
    ip: string;
  },
) {
  const sensor = await doorSensorsRepository.search().where("ipAddress").eq(
    ip,
  ).returnFirst() as DoorSensor | null;
  if (sensor === null) {
    await raiseError();
    return {
      type: "error",
      message: "",
    };
  }
  const currentState = await doorSensorStateRepository.search().where(
    "ipAddress",
  ).eq(ip).returnFirst() as doorSensorState | null;
  if (currentState === null) {
    //TODO: Raise error
    return {
      type: "error",
      message: "",
    };
  }
  const previousState = { ...currentState };
  checkSensorState(sensor, previousState, state);
  checkSensorTemperature(temperature, sensor);
  currentState.state = state;
  currentState.temperature = temperature;
  currentState.date = new Date();
  await doorSensorStateRepository.save(currentState);
  await emitNewData(previousState);
}

async function changeAlarmState(alarms: Alarm[] | [], state: "on" | "off") {
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

async function raiseError() {
  //TODO: Code Raise error function
}

async function checkSensorState(
  sensor: DoorSensor,
  previousState: doorSensorState,
  state: "open" | "closed" | "unknown",
) {
  if (previousState.armed && state === "open") {
    const alarms = await alarmRepository.search().returnAll() as Alarm[] | [];
    const alarmpromises = [];
    alarmpromises.push(changeAlarmState(alarms, "on"));
    alarmpromises.push(raiseEvent(
      "critical",
      `Alarm triggered by sensor at ${sensor.name} in ${sensor.building} with ip address of ${sensor.ipAddress}`,
    ));
    await Promise.all(alarmpromises);
  }
}

async function checkSensorTemperature(temperature: number, sensor: DoorSensor) {
  const config = await configRepository.search().returnFirst() as Config | null;
  if (config === null) {
    // TODO: Raise error
    return;
  }
  const startText =
    `Sensor at ${sensor.name} in ${sensor.building} is above configured`;
  const endText =
    `, current temperature is ${temperature}°C. \n This was detected at ${
      new Date().toString()
    }. \n These devices are rated to work between -20C and 80C.`;
  if (temperature > config.sensorCriticalTemparature) {
    await raiseEvent(
      "critical",
      startText + `critical temperature ${config.sensorCriticalTemparature}°C` +
        endText,
    );
    return;
  }
  if (temperature > config.sensorWarningTemparature) {
    await raiseEvent(
      "warning",
      startText + `warning temperature ${config.sensorWarningTemparature}°C` +
        endText,
    );
    return;
  }
}

async function emitNewData(previousState: doorSensorState) {
  io.emit("newDate", new Date());
}
