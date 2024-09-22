import { doorSensorStateEnum, sensorUpdatesTable } from "./sensorUpdates";
import { doorSensorsTable } from "./doorSensors";
import { buildingTable as buildingsTable } from "./buildings";
import { eventLogsTable, eventTypeEnum } from "./eventLogs";
import { accessLogsTable, actionEnum, connectionEnum } from "./accessLogs";
import { errorLogsTable } from "./errorLogs";
import { sensorLogsTable } from "./sensorLogs";

export const actionEnums = actionEnum;
export const eventTypeEnums = eventTypeEnum;
export const connectionEnums = connectionEnum;


export const generalLogTable = accessLogsTable;
export const errorLogTable = errorLogsTable;
export const eventLogTable = eventLogsTable;
export const doorSensorState = doorSensorStateEnum;
export const sensorUpdateTable = sensorUpdatesTable;
export const sensorLogTable = sensorLogsTable;
export const doorSensorTable = doorSensorsTable;
export const buildingTable = buildingsTable;

export const db = {
  actionEnums,
  eventTypeEnums,
  connectionEnums,
  errorLogTable,
  generalLogTable,
  eventLogTable,
  doorSensorState,
  sensorUpdateTable,
  sensorLogTable,
  doorSensorTable,
  buildingTable,
};
