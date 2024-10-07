import { doorSensorStateEnum, sensorUpdatesTable } from "./sensorUpdates.js";
import { sensorsTable } from "./sensors.js";
import { buildingTable as buildingsTable } from "./buildings.js";
import { eventLogsTable, eventTypeEnum } from "./eventLogs.js";
import { accessLogsTable, actionEnum, connectionEnum } from "./accessLogs.js";
import { errorLogsTable } from "./errorLogs.js";
import { sensorLogsTable } from "./sensorLogs.js";
import { alarmLogsTable } from "./alarmLogs.js";
import { alarmUpdatesTable, alarmStateEnum } from "./alarmUpdates.js";
import { alarmsTable } from "./alarms.js";

export const actionEnums = actionEnum;
export const eventTypeEnums = eventTypeEnum;
export const connectionEnums = connectionEnum;
export const alarmStateEnums = alarmStateEnum;

export const generalLogTable = accessLogsTable;
export const errorLogTable = errorLogsTable;
export const eventLogTable = eventLogsTable;
export const doorSensorState = doorSensorStateEnum;
export const sensorUpdateTable = sensorUpdatesTable;
export const sensorLogTable = sensorLogsTable;
export const doorSensorTable = sensorsTable;
export const buildingTable = buildingsTable;
export const alarmLogTable = alarmLogsTable;
export const alarmUpdateTable = alarmUpdatesTable;
export const alarmTable = alarmsTable;

export const db = {
  actionEnums,
  eventTypeEnums,
  connectionEnums,
  alarmStateEnums,
  errorLogTable,
  generalLogTable,
  eventLogTable,
  doorSensorState,
  alarmLogTable,
  sensorUpdateTable,
  sensorLogTable,
  doorSensorTable,
  buildingTable,
  alarmTable,
};
