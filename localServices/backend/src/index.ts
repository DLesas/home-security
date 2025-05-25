import "./config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { errorHandler, loggingMiddleware } from "./express/middleware";
import cors from "cors";
import sensorRoutes from "./express/routes/Sensors";
import buildingRoutes from "./express/routes/Buildings";
import alarmRoutes from "./express/routes/Alarms";
import logsRoutes from "./express/routes/logs";
import setupSocketHandlers from "./express/socketHandler";
import { runMigrations, runCustomSQL } from "./db/db";
import { connectRedis } from "./redis/index";
import {
  createDoorSensorIndex,
  doorSensor,
  doorSensorRepository,
} from "./redis/doorSensors";
import { createConfigIndex, setDefaultConfig } from "./redis/config";
import { createAlarmIndex } from "./redis/alarms";
import { setSensorStatusUnknown } from "./sensorFuncs";
import { SocketEventSubscriber } from "./express/socketEventSubscriber";
// import { startBonjourService } from "./express/advertisement/Bonjour";
// import { startUdpListener } from "./express/advertisement/udpBroadcast";

const corsOptions = {
  // For development: allow all origins
  origin: true, // This allows any origin in development
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});
const port = process.env.SERVER_PORT ? Number(process.env.SERVER_PORT) : 8080;

await connectRedis();
await createDoorSensorIndex();
await createConfigIndex();
await createAlarmIndex();
await setDefaultConfig();
await runMigrations();
// await runCustomSQL();
// on startup might want to consider setting all sensors
// to unknown as to not trigger false alarms
// as previous state of sensors will stay in redis
// if power outages happen
await setSensorStatusUnknown(
  (await doorSensorRepository.search().returnAll()) as doorSensor[]
);

app.set("trust proxy", true);
app.use(express.json());
app.use(cors(corsOptions));
app.use(loggingMiddleware);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Routes
app.use("/api/v1/sensors", sensorRoutes);
app.use("/api/v1/buildings", buildingRoutes);
app.use("/api/v1/alarms", alarmRoutes);
app.use("/api/v1/logs", logsRoutes);

// Error handling middleware
app.use(errorHandler);

setupSocketHandlers(io);

// Initialize the Socket Event Subscriber
const socketEventSubscriber = new SocketEventSubscriber();

server.listen(port, async () => {
  console.log(`Server is running on http://localhost:${port}`);

  // Start the Socket Event Subscriber
  await socketEventSubscriber.start();

  //const cleanupBonjour = startBonjourService();
  // const cleanupUdpBroadcast = startUdpListener();

  const shutdown = async () => {
    console.log("Shutting down gracefully...");

    // Stop the Socket Event Subscriber
    await socketEventSubscriber.stop();

    //cleanupBonjour();
    //cleanupUdpBroadcast();

    // Close the server
    server.close(() => {
      console.log("HTTP server closed");
    });

    // Close Socket.IO connections
    io.close(() => {
      console.log("Socket.IO server closed");
    });

    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
});

export { io };
