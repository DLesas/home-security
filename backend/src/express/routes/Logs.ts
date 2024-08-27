import express from "express";
import { z } from "zod";
import { DoorSensorUpdate } from "../../sensorFuncs";
import { doorSensorRepository } from "../../redis/doorSensors";
import { emitNewData } from "../socketHandler";
import { raiseError } from "../../errorHandling";

const router = express.Router();

router.post("/", async (req, res) => {
	const validationSchema = z.object({
		sensorId: z.string(),
		status: z.enum(["open", "closed"]),
		temperature: z.number(),
	});
	const result = validationSchema.safeParse(req.body);
	if (!result.success) {
		raiseError(400, JSON.stringify(result.error.errors));
		return;
	}
	const { sensorId, status, temperature } = result.data;
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
