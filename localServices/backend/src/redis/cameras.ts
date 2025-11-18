import { Repository, Schema } from "redis-om";
import { redis } from "./index";

export enum CameraProtocol {
  UDP = "udp",
  RTSP = "rtsp",
}

const cameraSchema = new Schema("cameras", {
  name: { type: "string" },
  externalID: { type: "string" },
  building: { type: "string" },
  ipAddress: { type: "string" },
  port: { type: "number" },
  protocol: { type: "string" }, // "udp" or "rtsp"
  macAddress: { type: "string" },
  temperature: { type: "number" },
  voltage: { type: "number" },
  frequency: { type: "number" },
  expectedSecondsUpdated: { type: "number" },
  lastUpdated: { type: "date" },
});


export const cameraRepository = new Repository(cameraSchema, redis);

export interface Camera {
  name: string;
  externalID: string;
  building?: string;
  ipAddress?: string;
  port: number;
  protocol?: CameraProtocol; // Defaults to UDP if not specified
  macAddress?: string;
  temperature?: number;
  voltage?: number;
  frequency?: number;
  expectedSecondsUpdated: number;
  lastUpdated: Date;
}

export const createCameraIndex = async () => {
  try {
    await cameraRepository.createIndex();
  } catch (error) {
    console.error("Error creating camera index:", error);
  }
};
