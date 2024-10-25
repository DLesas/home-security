import { doorSensorStateEnum, sensorUpdatesTable } from "./sensorUpdates";
import { sensorsTable } from "./sensors";
import { buildingTable as buildingsTable } from "./buildings";
import { eventLogsTable, eventTypeEnum } from "./eventLogs";
import { accessLogsTable, actionEnum, connectionEnum } from "./accessLogs";
import { errorLogsTable } from "./errorLogs";
import { sensorLogsTable } from "./sensorLogs";
import { alarmLogsTable } from "./alarmLogs";
import { alarmUpdatesTable, alarmStateEnum } from "./alarmUpdates";
import { alarmsTable } from "./alarms";

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
