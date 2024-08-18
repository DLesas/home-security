import { type doorSensor, doorSensorRepository } from "./redis/doorSensors";
import express from "express";
// import https from "https";
import http from "http";
import { z } from "zod";
import { Server } from "socket.io";
import { db } from "./db/db";
import { accessLogsTable } from "./db/schema/accessLogs";
import { changeSensorStatus, DoorSensorUpdate } from "./sensorFuncs";
import { buildingTable } from "./db/schema/buildings";
import { eq } from "drizzle-orm";
import { doorSensorsTable } from "./db/schema/doorSensors";

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

// route to be used by the server front end (electron)
app.post("api/v1/sensors/new", async (req, res) => {
  const validationSchema = z.object({
    name: z.string(),
    building: z.string(),
  });
  const validationResult = validationSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).send({
      status: "error",
      message: validationResult.error,
    });
    return;
  }
  const buildingName = validationResult.data.building;
  const sensorName = validationResult.data.name;
  const buildingObject = await db.select().from(buildingTable).where(
    eq(buildingTable.name, buildingName),
  ).limit(1);
  if (buildingObject.length === 0) {
    res.status(404).send({
      status: "error",
      message: "Building not found",
    });
    return;
  }
  const externalID = Math.floor(Math.random() * 1000000);
  const doorSensorDBObject = (await db.insert(doorSensorsTable).values({
    name: sensorName,
    buildingId: buildingObject[0].id,
  }).returning())[0];

});

app.post("api/v1/sensors/handshake", async (req, res) => {});

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

async function emitNewData() {
  // TODO: decide on funcion to emit new data
  io.emit("newData", new Date());
}
