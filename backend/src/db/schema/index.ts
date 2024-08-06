import { doorSensorStateEnum, sensorLogsTable } from "./sensorLogs";
import { doorSensorsTable } from "./doorSensors";
import { buildingTable as buildingsTable } from "./buildings";
import { eventLogsTable } from "./eventLogs";
import { actionEnum, connectionEnum, generalLogsTable } from "./generalLogs";

export const actionEnums = actionEnum;
export const connectionEnums = connectionEnum;

export const generalLogTable = generalLogsTable;
export const eventLogTable = eventLogsTable;
export const doorSensorState = doorSensorStateEnum;
export const sensorLogTable = sensorLogsTable;
export const doorSensorTable = doorSensorsTable;
export const buildingTable = buildingsTable;

export const db = {
  actionEnums,
  connectionEnums,
  generalLogTable,
  eventLogTable,
  doorSensorState,
  sensorLogTable,
  doorSensorTable,
  buildingTable,
};
