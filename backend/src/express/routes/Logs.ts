import express from "express";
import { z } from "zod";
import { DoorSensorUpdate } from "../../sensorFuncs.js";
import { doorSensorRepository } from "../../redis/doorSensors.js";
import { emitNewData } from "../socketHandler.js";
import { raiseError } from "../../errorHandling.js";

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
