import { io } from "../index.js";
import { Server } from "socket.io";
import { type doorSensor, doorSensorRepository } from "../redis/doorSensors.js";
import { type Alarm, alarmRepository } from "../redis/alarms.js";


export async function emitNewData() {
	const sensors = (await doorSensorRepository.search().returnAll()) as doorSensor[];
	const alarms = (await alarmRepository.search().returnAll()) as Alarm[];
	io.emit("data", {sensors, alarms});
}

const setupSocketHandlers = (io: Server) => {
	io.on("connection", async (socket) => {
		const sensors = (await doorSensorRepository.search().returnAll()) as doorSensor[];
		const alarms = (await alarmRepository.search().returnAll()) as Alarm[];
		socket.emit("data", {sensors, alarms});

		// Add more socket event handlers here
		// For example:
		// socket.on("disconnect", () => {
		//     console.log("User disconnected");
		// });
	});
};

export default setupSocketHandlers;
