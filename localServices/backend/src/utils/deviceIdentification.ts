import { Request } from "express";
import { doorSensorRepository, type doorSensor } from "../redis/doorSensors";
import { alarmRepository, type Alarm } from "../redis/alarms";

export interface DeviceInfo {
  id: string;
  type: "sensor" | "alarm";
  name: string;
  building: string;
  identificationMethod: "device_header";
  ipAddress?: string;
  macAddress?: string;
}

/**
 * Identifies a device purely from request headers
 * Requires X-Device-ID and X-Device-Type headers to be present
 */
export async function identifyDevice(req: Request): Promise<DeviceInfo | null> {
  const deviceId = req.headers["x-device-id"] as string;
  const deviceType = req.headers["x-device-type"] as string;
  const deviceMac = req.headers["x-device-mac"] as string;
  const deviceIp = req.headers["x-device-ip"] as string;

  // Require device headers for identification
  if (!deviceId || !deviceType) {
    console.log(
      "Device identification failed: Missing required headers (X-Device-ID, X-Device-Type)"
    );
    return null;
  }

  console.log(
    `Identifying device by header: ID=${deviceId}, Type=${deviceType}, MAC=${deviceMac}, IP=${deviceIp}`
  );

  if (deviceType === "sensor") {
    const sensor = (await doorSensorRepository
      .search()
      .where("externalID")
      .eq(deviceId)
      .returnFirst()) as doorSensor | null;

    if (sensor) {
      // Update device info if needed
      const needsUpdate =
        !sensor.ipAddress ||
        sensor.ipAddress !== deviceIp ||
        !sensor.macAddress ||
        sensor.macAddress !== deviceMac;

      if (needsUpdate) {
        await doorSensorRepository.save({
          ...sensor,
          ipAddress: deviceIp,
          macAddress: deviceMac || sensor.macAddress,
          lastUpdated: new Date(),
        } as doorSensor);
      }

      return {
        id: sensor.externalID,
        type: "sensor",
        name: sensor.name,
        building: sensor.building,
        identificationMethod: "device_header",
        ipAddress: deviceIp,
        macAddress: deviceMac,
      };
    }
  } else if (deviceType === "alarm") {
    const alarm = (await alarmRepository
      .search()
      .where("externalID")
      .eq(deviceId)
      .returnFirst()) as Alarm | null;

    if (alarm) {
      // Update device info if needed
      const needsUpdate =
        !alarm.ipAddress ||
        alarm.ipAddress !== deviceIp ||
        !alarm.macAddress ||
        alarm.macAddress !== deviceMac;

      if (needsUpdate) {
        await alarmRepository.save({
          ...alarm,
          ipAddress: deviceIp,
          macAddress: deviceMac || alarm.macAddress,
          lastUpdated: new Date(),
        } as Alarm);
      }

      return {
        id: alarm.externalID,
        type: "alarm",
        name: alarm.name,
        building: alarm.building,
        identificationMethod: "device_header",
        ipAddress: deviceIp,
        macAddress: deviceMac,
      };
    }
  }

  console.log(
    `Device not found in database: ID=${deviceId}, Type=${deviceType}`
  );
  return null;
}
