// Import the 'express' module
import { EntityId } from "redis-om";
import {
  type doorSensorState,
  doorSensorStateRepository,
} from "./redis/doorSensorState";
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

app.post("/api/v1/buildings/:building/sensors/arm", async (req, res) => {
  const building = req.params.building;
  // Logic to arm all sensors in the specified building
  res.send(`All sensors in building ${building} have been armed.`);
});

// Route to disarm all sensors in a specific building
app.post("/api/v1/buildings/:building/sensors/disarm", async (req, res) => {
  const building = req.params.building;
  // Logic to disarm all sensors in the specified building
  res.send(`All sensors in building ${building} have been disarmed.`);
});

app.post(
  "/api/v1/buildings/:building/sensors/:sensor/arm",
  async (req, res) => {
    const { building, sensor } = req.params;
    // Logic to arm the specific sensor in the specified building
    res.send(`Sensor ${sensor} in building ${building} has been armed.`);
  },
);

// Route to disarm a specific sensor in a specific building
app.post(
  "/api/v1/buildings/:building/sensors/:sensor/disarm",
  async (req, res) => {
    const { building, sensor } = req.params;
    // Logic to disarm the specific sensor in the specified building
    res.send(`Sensor ${sensor} in building ${building} has been disarmed.`);
  },
);

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
  const currentState = await doorSensorStateRepository.search().where(
    "ipAddress",
  ).eq(ip).returnFirst() as doorSensorState | null;
  if (currentState === null) {
    raiseError();
    return;
  }
  const previousState = { ...currentState };
  checkSensorState(previousState, state);
  checkSensorTemperature(temperature, previousState);
  currentState.state = state;
  currentState.temperature = temperature;
  currentState.date = new Date();
  await doorSensorStateRepository.save(currentState);
}

async function changeSensorStatus() {
}

async function emitNewData() {
  io.emit("newData", new Date());
}
