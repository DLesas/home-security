import express from "express";
import { z } from "zod";
import { DoorSensorUpdate } from "../../sensorFuncs";
import { doorSensorRepository } from "../../redis/doorSensors";
import { emitNewData } from "../socketHandler";

const router = express.Router();

router.post("/", async (req, res) => {
	const validationSchema = z.object({
		sensorId: z.string(),
		status: z.enum(["open", "closed"]),
		temperature: z.number(),
	});
	const { error, data } = validationSchema.safeParse(req.body);
	if (error) {
		return res.status(400).json({ status: "error", message: error.errors });
	}
	const { sensorId, status, temperature } = data;
	await DoorSensorUpdate({ sensorId, state: status, temperature });
	await emitNewData();
	res.json({ status: "success", message: "Log updated" });
});

// unsure if this route is needed
// router.get("/", async (req, res) => {
// 	const sensors = await doorSensorRepository.search().returnAll();
// 	res.json({ status: "success", data: sensors });
// });

export default router;
