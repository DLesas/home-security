import { io } from "../index";
import { Server } from "socket.io";
import { type doorSensor, doorSensorRepository } from "../redis/doorSensors";
import { type Alarm, alarmRepository } from "../redis/alarms";

/**
 * Emits updated sensor and alarm data to all connected clients
 * @async
 * @returns {Promise<void>} A promise that resolves when the data has been emitted
 * @throws {Error} If there's an error fetching data from repositories
 */
export async function emitNewData() {
  const sensors = (await doorSensorRepository
    .search()
    .returnAll()) as doorSensor[];
  const alarms = (await alarmRepository.search().returnAll()) as Alarm[];
  io.emit("data", { sensors, alarms });
}

/**
 * Sets up WebSocket event handlers for the Socket.IO server
 * @param {Server} io - The Socket.IO server instance
 * @returns {void}
 */
const setupSocketHandlers = (io: Server) => {
  io.on("connection", async (socket) => {
    const sensors = (await doorSensorRepository
      .search()
      .returnAll()) as doorSensor[];
    const alarms = (await alarmRepository.search().returnAll()) as Alarm[];
    socket.emit("data", { sensors, alarms });

    // Add more socket event handlers here
    // For example:
    // socket.on("disconnect", () => {
    //     console.log("User disconnected");
    // });
  });
};

export default setupSocketHandlers;
