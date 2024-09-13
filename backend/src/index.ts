import express from "express";
import http from "http";
import { Server } from "socket.io";
import { errorHandler, loggingMiddleware } from "./express/middleware";
import sensorRoutes from "./express/routes/Sensors";
import buildingRoutes from "./express/routes/Buildings";
import alarmRoutes from "./express/routes/Alarms";
import logRoutes from "./express/routes/Logs";
import setupSocketHandlers from "./express/socketHandler";
import { runMigrations } from "./db/db";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 8080;

await runMigrations();

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

