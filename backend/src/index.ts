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
import { type selectEventLog } from "./db/schema/eventLogs";
import { checkSensorState, checkSensorTemperature } from "./sensorFuncs";
import { raiseError } from "./errorHandling";

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
  await emitNewData();
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
    return;
  }
  const currentState = await doorSensorStateRepository.search().where(
    "ipAddress",
  ).eq(ip).returnFirst() as doorSensorState | null;
  if (currentState === null) {
    raiseError();
    return;
  }
  const previousState = { ...currentState };
  checkSensorState(sensor, previousState, state);
  checkSensorTemperature(temperature, sensor);
  currentState.state = state;
  currentState.temperature = temperature;
  currentState.date = new Date();
  await doorSensorStateRepository.save(currentState);
}

async function emitNewData() {
  io.emit("newData", new Date());
}
