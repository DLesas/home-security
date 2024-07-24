import {
  doorSensorStateEnum,
  sensorLogsTable,
} from "./sensorLogs";
import { doorSensorsTable } from "./doorSensors";
import { buildingTable as buildingsTable } from "./buildings";

export const doorSensorState = doorSensorStateEnum;
export const sensorLogTable = sensorLogsTable;
export const doorSensorTable = doorSensorsTable;
export const buildingTable = buildingsTable;

export const db = {
  doorSensorState,
  sensorLogTable,
  doorSensorTable,
  buildingTable,
};
