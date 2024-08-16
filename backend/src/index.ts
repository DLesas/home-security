// Import the 'express' module
import { type doorSensor, doorSensorRepository } from "./redis/doorSensors";
import { integer } from "drizzle-orm/pg-core";
import express, { Request, Response } from "express";
import https from "https";
import http from "http";
import { Server } from "socket.io";
import { db } from "./db/db";
import { accessLogsTable } from "./db/schema/accessLogs";
import {
  changeSensorStatus,
  checkSensorState,
  checkSensorTemperature,
} from "./sensorFuncs";
import { raiseError } from "./errorHandling";
import { sensorLogsTable } from "./db/schema/sensorLogs";

// Create an Express application
const app = express();
app.use(express.json());
app.use(async (req, res, next) => {
  const clientIp = req.ip!;
  await db.insert(accessLogsTable).values({
    endpoint: req.baseUrl + req.path,
    queryString: req.query.toString(),
    action: req.method as "GET" | "POST" | "DELETE" | "PUT",
    connection: "http",
    clientIp,
    userAgent: req.headers["user-agent"],
  });
  next();
});

// const options = {
//   key: fs.readFileSync("./test_key.key"),
//   cert: fs.readFileSync("./test_cert.crt"),
//   ca: fs.readFileSync("./test_ca.crt"),
//   requestCert: false,
//   rejectUnauthorized: false,
// };

// const server = https.createServer(options, app);
const server = http.createServer(app);
const io = new Server(server);
const port = 8080;

io.on("connection", (socket) => {
  console.log("a user connected");
});

// Route to arm all sensors in a specific building
app.post("/api/v1/buildings/:building/arm", async (req, res) => {
  const building = req.params.building;
  const sensors = await doorSensorRepository.search().where(
    "building",
  ).eq(building).returnAll() as doorSensor[] | [];
  await changeSensorStatus(sensors, true);
  await emitNewData();
  res.send({
    status: "success",
    message: `All sensors in building ${building} have been armed.`,
  });
});

// Route to disarm all sensors in a specific building
app.post("/api/v1/buildings/:building/disarm", async (req, res) => {
  const building = req.params.building;
  const sensors = await doorSensorRepository.search().where(
    "building",
  ).eq(building).returnAll() as doorSensor[] | [];
  await changeSensorStatus(sensors, false);
  await emitNewData();
  res.send({
    status: "success",
    message: `All sensors in building ${building} have been disarmed.`,
  });
});

app.post("api/v1/sensors/new", async (req, res) => {
});

// Route to arm a specific sensor
app.post(
  "/api/v1/sensors/:sensor/arm",
  async (req, res) => {
    const { sensor } = req.params;
    const sensors = [
      await doorSensorRepository.search().where("externalID").eq(sensor)
        .returnFirst() as doorSensor | null,
    ];
    if (sensors.includes(null)) {
      res.status(404).send({
        status: "error",
        message: "Sensor not found",
      });
      return;
    }
    const validSensors = sensors as doorSensor[];
    await changeSensorStatus(validSensors, true);
    await emitNewData();
    res.send({
      status: "success",
      message: `${validSensors[0].name} sensor in ${
        validSensors[0].building
      } has been armed.`,
    });
  },
);

// Route to disarm a specific sensor
app.post(
  "/api/v1/sensors/:sensor/disarm",
  async (req, res) => {
    const { sensor } = req.params;
    const sensors = [
      await doorSensorRepository.search().where("externalID").eq(sensor)
        .returnFirst() as doorSensor | null,
    ];
    if (sensors.includes(null)) {
      res.status(404).send({
        status: "error",
        message: "Sensor not found",
      });
      return;
    }
    const validSensors = sensors as doorSensor[];
    await changeSensorStatus(validSensors, false);
    await emitNewData();
    res.send({
      status: "success",
      message: `${validSensors[0].name} sensor in ${
        validSensors[0].building
      } has been disarmed.`,
    });
  },
);

app.post("/api/v1/logs", async (req, res) => {
  const { state, temperature }: {
    state: "open" | "closed";
    temperature: number;
  } = req.body;
  const clientIp = req.ip!;
  await DoorSensorUpdate({ state, temperature, ip: clientIp });
  await emitNewData();
  res.send({ status: "success", message: "new state saved" });
});

app.get("/api/v1/state", async (req, res) => {
  const sensorStates = await doorSensorRepository.search().returnAll();
  res.send(sensorStates);
});

// Start the server and listen on the specified port
server.listen(port, () => {
  // Log a message when the server is successfully running
  console.log(`Server is running on http://localhost:${port}`);
});

/**
 * Updates the state and temperature of a door sensor, also checks if any alarms need to be triggered or if the temperature is too high.
 *
 * @param {object} params - An object containing the state, temperature, and IP address of the door sensor that triggered this endpoint.
 * @param {("open" | "closed" | "unknown")} params.state - The new state of the door sensor.
 * @param {number} params.temperature - The new temperature of the door sensor.
 * @param {string} params.ip - The IP address of the door sensor that triggered this endpoint.
 * @return {Promise<void>} A promise that resolves when the update of redis is complete.
 */
async function DoorSensorUpdate(
  { state, temperature, ip }: {
    state: "open" | "closed" | "unknown";
    temperature: number;
    ip: string;
  },
) {
  const currentState = await doorSensorRepository.search().where(
    "ipAddress",
  ).eq(ip).returnFirst() as doorSensor | null;
  if (currentState === null) {
    raiseError();
    return;
  }
  checkSensorState(currentState, state);
  checkSensorTemperature(temperature, currentState);
  currentState.state = state;
  currentState.temperature = temperature;
  currentState.date = new Date();
  db.insert(sensorLogsTable).values({
    sensorId: parseInt(currentState.externalID),
    state: state,
    temperature: temperature.toString(),
  });
  await doorSensorRepository.save(currentState);
}

async function emitNewData() {
  // TODO: decide on funcion to emit new data
  io.emit("newData", new Date());
}
