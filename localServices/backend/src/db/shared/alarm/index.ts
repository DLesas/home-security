export const ALARM_STATES = ["on", "off", "unknown"] as const;
export type AlarmState = (typeof ALARM_STATES)[number];
