import { io } from "../index";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { type doorSensor, doorSensorRepository } from "../redis/doorSensors";
import { type Alarm, alarmRepository } from "../redis/alarms";
import { type Camera, cameraRepository } from "../redis/cameras";
import {
  type RecurringSchedule,
  type OneTimeSchedule,
  recurringScheduleRepository,
  oneTimeScheduleRepository,
} from "../redis/schedules";

/**
 * Fetches all data from repositories and returns formatted payload
 */
async function getAllData() {
  const sensors = (await doorSensorRepository
    .search()
    .returnAll()) as doorSensor[];
  const alarms = (await alarmRepository.search().returnAll()) as Alarm[];
  const camerasRaw = (await cameraRepository.search().return.all()) as Camera[];

  // Map cameras to only emit necessary properties
  const cameras = camerasRaw.map((c) => ({
    externalID: c.externalID,
    name: c.name,
    building: c.building,
    motionDetectionEnabled: c.motionDetectionEnabled,
    mog2History: c.mog2History,
    mog2VarThreshold: c.mog2VarThreshold,
    mog2DetectShadows: c.mog2DetectShadows,
    motionZones: c.motionZones,
    expectedSecondsUpdated: c.expectedSecondsUpdated,
    lastUpdated: c.lastUpdated,
  }));

  // Fetch schedule data
  const recurringSchedules = (await recurringScheduleRepository
    .search()
    .returnAll()) as RecurringSchedule[];
  const oneTimeSchedules = (await oneTimeScheduleRepository
    .search()
    .returnAll()) as OneTimeSchedule[];

  // Combine schedule data
  const schedules = [
    ...recurringSchedules.map((s) => ({ ...s, type: "recurring" })),
    ...oneTimeSchedules.map((s) => ({ ...s, type: "oneTime" })),
  ];

  return { sensors, alarms, cameras, schedules };
}

/**
 * Emits updated sensor, alarm, camera, and schedule data to all connected clients
 */
export async function emitNewData() {
  const data = await getAllData();
  io.emit("data", data);
}

/**
 * Sets up WebSocket event handlers for the Socket.IO server with Redis adapter for multi-process support
 */
const setupSocketHandlers = async (io: Server) => {
  // Create Redis clients for the Socket.IO adapter
  const pubClient = createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  });
  const subClient = pubClient.duplicate();

  // Connect both clients
  await Promise.all([pubClient.connect(), subClient.connect()]);

  // Configure Socket.IO to use Redis adapter for distributed broadcasting
  io.adapter(createAdapter(pubClient, subClient));
  console.log("Socket.IO Redis adapter enabled - ready for multi-process scaling");

  // Set up error handlers for adapter Redis clients
  pubClient.on("error", (err) => console.error("Socket.IO adapter pub client error:", err));
  subClient.on("error", (err) => console.error("Socket.IO adapter sub client error:", err));

  io.on("connection", async (socket) => {
    console.log(`Client connected: ${socket.id}`);

    const data = await getAllData();
    socket.emit("data", data);

    // Handle camera subscription requests
    socket.on("subscribe:camera", (cameraId: string) => {
      const roomName = `camera:${cameraId}`;
      socket.join(roomName);
      console.log(`Client ${socket.id} subscribed to ${roomName}`);
    });

    // Handle camera unsubscription requests
    socket.on("unsubscribe:camera", (cameraId: string) => {
      const roomName = `camera:${cameraId}`;
      socket.leave(roomName);
      console.log(`Client ${socket.id} unsubscribed from ${roomName}`);
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};

export default setupSocketHandlers;
