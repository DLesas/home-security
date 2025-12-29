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
  // Note: modelSettings and motionZones are stored as JSON strings in Redis
  const cameras = camerasRaw.map((c) => {
    // Parse modelSettings if it's a string
    let modelSettings = c.modelSettings;
    if (typeof modelSettings === 'string') {
      try {
        modelSettings = JSON.parse(modelSettings);
      } catch {
        modelSettings = { history: 500, varThreshold: 16, detectShadows: false };
      }
    }

    // Parse motionZones if it's a string
    let motionZones = c.motionZones;
    if (typeof motionZones === 'string') {
      try {
        motionZones = JSON.parse(motionZones);
      } catch {
        motionZones = [];
      }
    }

    return {
      externalID: c.externalID,
      name: c.name,
      building: c.building,
      motionDetectionEnabled: c.motionDetectionEnabled,
      detectionModel: c.detectionModel,
      modelSettings,
      motionZones,
      expectedSecondsUpdated: c.expectedSecondsUpdated,
      lastUpdated: c.lastUpdated,
      maxStreamFps: c.maxStreamFps,
      maxRecordingFps: c.maxRecordingFps,
      jpegQuality: c.jpegQuality,
    };
  });

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

// Track active motion subscriptions per camera
const motionSubscriptions = new Map<string, ReturnType<typeof createClient>>();
// Track pending subscriptions to prevent race conditions
const pendingSubscriptions = new Set<string>();

/**
 * Subscribe to motion events for a camera and forward to Socket.IO room
 */
async function subscribeToMotion(cameraId: string, io: Server) {
  // Check if already subscribed or subscription in progress
  if (motionSubscriptions.has(cameraId) || pendingSubscriptions.has(cameraId)) {
    return; // Already subscribed or in progress
  }

  // Mark as pending to prevent duplicate subscriptions
  pendingSubscriptions.add(cameraId);

  try {
    const motionClient = createClient({
      url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    });

    await motionClient.connect();

    const channel = `motion:${cameraId}`;
    await motionClient.subscribe(channel, (message) => {
      try {
        const data = JSON.parse(message);
        io.to(`camera:${cameraId}`).emit("motion", data);
      } catch (err) {
        console.error(`Error parsing motion event for ${cameraId}:`, err);
      }
    });

    motionSubscriptions.set(cameraId, motionClient);
    console.log(`Subscribed to motion events for camera: ${cameraId}`);
  } finally {
    pendingSubscriptions.delete(cameraId);
  }
}

/**
 * Unsubscribe from motion events for a camera
 */
async function unsubscribeFromMotion(cameraId: string, io: Server) {
  // Check if any clients are still in the room
  const room = io.sockets.adapter.rooms.get(`camera:${cameraId}`);
  if (room && room.size > 0) {
    return; // Still have subscribers
  }

  const client = motionSubscriptions.get(cameraId);
  if (client) {
    try {
      await client.unsubscribe(`motion:${cameraId}`);
      await client.quit();
    } catch (err) {
      console.error(`Error unsubscribing from motion for ${cameraId}:`, err);
    }
    motionSubscriptions.delete(cameraId);
    console.log(`Unsubscribed from motion events for camera: ${cameraId}`);
  }
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
    socket.on("subscribe:camera", async (cameraId: string) => {
      const roomName = `camera:${cameraId}`;
      socket.join(roomName);
      console.log(`Client ${socket.id} subscribed to ${roomName}`);

      // Subscribe to motion events for this camera
      await subscribeToMotion(cameraId, io);
    });

    // Handle camera unsubscription requests
    socket.on("unsubscribe:camera", async (cameraId: string) => {
      const roomName = `camera:${cameraId}`;
      socket.leave(roomName);
      console.log(`Client ${socket.id} unsubscribed from ${roomName}`);

      // Unsubscribe from motion if no more clients
      await unsubscribeFromMotion(cameraId, io);
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
      // Note: Socket.IO automatically removes the socket from rooms on disconnect
      // We could clean up motion subscriptions here, but it's handled by unsubscribe:camera
    });
  });
};

export default setupSocketHandlers;
