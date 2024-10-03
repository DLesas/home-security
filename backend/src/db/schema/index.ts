import { doorSensorStateEnum, sensorUpdatesTable } from "./sensorUpdates.js";
import { doorSensorsTable } from "./doorSensors.js";
import { buildingTable as buildingsTable } from "./buildings.js";
import { eventLogsTable, eventTypeEnum } from "./eventLogs.js";
import { accessLogsTable, actionEnum, connectionEnum } from "./accessLogs.js";
import { errorLogsTable } from "./errorLogs.js";
import { sensorLogsTable } from "./sensorLogs.js";
import { alarmLogsTable } from "./alarmLogs.js";

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
export const alarmLogTable = alarmLogsTable;
export const db = {
  actionEnums,
  eventTypeEnums,
  connectionEnums,
  errorLogTable,
  generalLogTable,
  eventLogTable,
  doorSensorState,
  alarmLogTable,
  sensorUpdateTable,
  sensorLogTable,
  doorSensorTable,
  buildingTable,
};
