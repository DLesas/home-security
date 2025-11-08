import { io } from "../index";
import { Server } from "socket.io";
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
 * Sets up WebSocket event handlers for the Socket.IO server
 * @param {Server} io - The Socket.IO server instance
 * @returns {void}
 */
const setupSocketHandlers = (io: Server) => {
  io.on("connection", async (socket) => {
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

    // Add more socket event handlers here
    // For example:
    // socket.on("disconnect", () => {
    //     console.log("User disconnected");
    // });
  });
};

export default setupSocketHandlers;
