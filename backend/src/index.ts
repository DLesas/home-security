import express from "express";
import http from "http";
import { Server } from "socket.io";
import { errorHandler, loggingMiddleware } from "./express/middleware.js";
import sensorRoutes from "./express/routes/Sensors.js";
import buildingRoutes from "./express/routes/Buildings.js";
import alarmRoutes from "./express/routes/Alarms.js";
import logRoutes from "./express/routes/Logs.js";
import setupSocketHandlers from "./express/socketHandler.js";
import { runMigrations, runCustomSQL } from "./db/db.js";
import { connectRedis } from "./redis/index.js";
import { createDoorSensorIndex } from "./redis/doorSensors.js";
import { createConfigIndex, setDefaultConfig } from "./redis/config.js";
import { createAlarmIndex } from "./redis/alarms.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 8080;

await connectRedis();
await createDoorSensorIndex();
await createConfigIndex();
await createAlarmIndex();
await setDefaultConfig();
await runMigrations();
// await runCustomSQL();

app.use(express.json());
app.use(loggingMiddleware);

// on startup might want to consider setting all sensors
// to unknown as to not trigger false alarms
// as previous state of sensors will stay in redis
// if power outages happen

// Routes
app.use("/api/v1/sensors", sensorRoutes);
app.use("/api/v1/buildings", buildingRoutes);
app.use("/api/v1/logs", logRoutes);
app.use("/api/v1/alarms", alarmRoutes);

// Error handling middleware
app.use(errorHandler);

setupSocketHandlers(io);

server.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});

export { io };

