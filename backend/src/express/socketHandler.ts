import { io } from "../index.js";
import { Server } from "socket.io";
import { type doorSensor, doorSensorRepository } from "../redis/doorSensors.js";

export async function emitNewData() {
	const sensors = (await doorSensorRepository.search().returnAll()) as doorSensor[];
	io.emit("data", sensors);
}

const setupSocketHandlers = (io: Server) => {
	io.on("connection", async (socket) => {
		const sensors = (await doorSensorRepository.search().returnAll()) as doorSensor[];
		socket.emit("data", sensors);

		// Add more socket event handlers here
		// For example:
		// socket.on("disconnect", () => {
		//     console.log("User disconnected");
		// });
	});
};

export default setupSocketHandlers;
