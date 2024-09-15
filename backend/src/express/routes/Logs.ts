import express from "express";
import { z } from "zod";
import { DoorSensorUpdate } from "../../sensorFuncs";
import { doorSensorRepository } from "../../redis/doorSensors";
import { emitNewData } from "../socketHandler";
import { raiseError } from "../../errorHandling";

const router = express.Router();



router.post("/device", async (req, res) => {
	const { sensorId, log } = req.body;
	
})
// unsure if this route is needed
// router.get("/", async (req, res) => {	
// 	const sensors = await doorSensorRepository.search().returnAll();
// 	res.json({ status: "success", data: sensors });
// });

export default router;
