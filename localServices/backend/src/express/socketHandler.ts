import { io } from "../index";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { type doorSensor, doorSensorRepository } from "../redis/doorSensors";
import { type Alarm, alarmRepository } from "../redis/alarms";
import {
  type RecurringSchedule,
  type OneTimeSchedule,
  recurringScheduleRepository,
  oneTimeScheduleRepository,
} from "../redis/schedules";

/**
 * Emits updated sensor, alarm, and schedule data to all connected clients
 * @async
 * @returns {Promise<void>} A promise that resolves when the data has been emitted
 * @throws {Error} If there's an error fetching data from repositories
 */
export async function emitNewData() {
  const sensors = (await doorSensorRepository
    .search()
    .returnAll()) as doorSensor[];
  const alarms = (await alarmRepository.search().returnAll()) as Alarm[];

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

  io.emit("data", { sensors, alarms, schedules });
}

/**
 * Sets up WebSocket event handlers for the Socket.IO server with Redis adapter for multi-process support
 * @async
 * @param {Server} io - The Socket.IO server instance
 * @returns {Promise<void>} A promise that resolves when setup is complete
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

    // Send all data including sensors, alarms, and schedules
    const sensors = (await doorSensorRepository
      .search()
      .returnAll()) as doorSensor[];
    const alarms = (await alarmRepository.search().returnAll()) as Alarm[];

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

    socket.emit("data", { sensors, alarms, schedules });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};

export default setupSocketHandlers;
