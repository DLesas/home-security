// Import the 'express' module
import { EntityId } from "redis-om";
import { doorSensorStateRepository } from "./redis/doorSensorState";
import { doorSensorsRepository } from "./redis/doorSensor";
import express, { Request, Response } from "express";
import http from "http";
import { Server } from "socket.io";
import { db } from "./db/db";
import { generalLogsTable } from "./db/schema/generalLogs";
import { Placeholder, SQL } from "drizzle-orm";
import { configRepository } from "./redis/config";

// Create an Express application
const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server);
const port = 8080;

io.on("connection", (socket) => {
  console.log("a user connected");
});

io.emit("some-event", { some: "data" });

// Define a route for the root path ('/')
app.get("/", (req: Request, res: Response) => {
  // Send a response to the client
  res.send("Hello, TypeScript + Node.js + Express!");
});

app.post("/api/v1/logs", async (req, res) => {
  const { state, temperature }: {
    state: "open" | "closed";
    temperature: number;
  } = req.body;
  const clientIp = req.ip!;
  insertGeneralLog({
    endpoint: "api/v1/logs",
    action: "post",
    connection: "http",
    clientIp,
    userAgent: req.headers["user-agent"],
  });
});

app.get("/songs", async (req, res) => {
  const snesorStates = await doorSensorStateRepository.search().returnAll();
  res.send(snesorStates);
});

// Start the server and listen on the specified port
server.listen(port, () => {
  // Log a message when the server is successfully running
  console.log(`Server is running on http://localhost:${port}`);
});

async function insertGeneralLog(
  log: {
    connection: "http" | "socket";
    endpoint: string;
    action:
      | "post"
      | "get"
      | "delete"
      | "patch";
    clientIp: string;
    id?: number | undefined;
    dateTime?:
      | Date
      | null
      | undefined;
    userAgent?:
      | string
      | null
      | undefined;
  },
) {
  await db.insert(generalLogsTable).values(log);
}

async function dealWithDoorSensorUpdate(
  { state, temperature, ip }: {
    state: "open" | "closed";
    temperature: number;
    ip: string;
  },
) {
  const sensor = await doorSensorsRepository.search().where("ipAddress").eq(
    ip,
  ).returnFirst();
  const currentState = await doorSensorStateRepository.search().where(
    "ipAddress",
  ).eq(ip).returnFirst();
  const config = await configRepository.search().returnFirst();
  if (currentState && currentState.armed && state === "open") {
    // trigger alarm
  }

}
