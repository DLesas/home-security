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
import { camerasTable } from "./cameras";
import { cameraSettingsTable } from "./cameraSettings";
import { motionZonesTable } from "./motionZones";
import { detectionsTable } from "./detections";
import { detectionBoxesTable } from "./detectionBoxes";
import {
  scheduleExecutionsTable,
  scheduleActionEnum,
  scheduleTypeEnum,
  scheduleRecurrenceEnum,
} from "./scheduleExecutions";

export const actionEnums = actionEnum;
export const eventTypeEnums = eventTypeEnum;
export const connectionEnums = connectionEnum;
export const alarmStateEnums = alarmStateEnum;
export const scheduleActionEnums = scheduleActionEnum;
export const scheduleTypeEnums = scheduleTypeEnum;
export const scheduleRecurrenceEnums = scheduleRecurrenceEnum;

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
export const cameraTable = camerasTable;
export const cameraSettingTable = cameraSettingsTable;
export const motionZoneTable = motionZonesTable;
export const detectionTable = detectionsTable;
export const detectionBoxTable = detectionBoxesTable;
export const scheduleExecutionTable = scheduleExecutionsTable;

export const db = {
  actionEnums,
  eventTypeEnums,
  connectionEnums,
  alarmStateEnums,
  scheduleActionEnums,
  scheduleTypeEnums,
  scheduleRecurrenceEnums,
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
  cameraTable,
  cameraSettingTable,
  motionZoneTable,
  detectionTable,
  detectionBoxTable,
  scheduleExecutionTable,
};
