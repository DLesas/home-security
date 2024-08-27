import express from "express";
import { z } from "zod";
import { DoorSensorUpdate } from "../../sensorFuncs";
import { doorSensorRepository } from "../../redis/doorSensors";
import { emitNewData } from "../socketHandler";
import { raiseError } from "../../errorHandling";

const router = express.Router();

router.post("/", async (req, res) => {
	const validationSchema = z.object({
		sensorId: z
			.string({
				required_error: "sensorId is required",
				invalid_type_error: "sensorId must be a string",
			})
			.min(1, "sensorId must be at least 1 character")
			.max(255, "sensorId must be less than 255 characters"),
		status: z.enum(["open", "closed"], {
			required_error: "status is required",
			invalid_type_error: "status must be one of: open, closed",
		}),
		temperature: z
			.number({
				required_error: "temperature is required",
				invalid_type_error: "temperature must be a number",
			})
			.min(-100, "implausible temperature")
			.max(120, "implausible temperature"),
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
