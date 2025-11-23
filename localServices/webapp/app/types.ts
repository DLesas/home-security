export type LogStatus = 'open' | 'closed' | 'unknown'

export interface DoorValues {
  status: LogStatus
  armed: boolean
}

export interface DoorEntries {
  [key: string]: DoorValues
}

export type EventType = "debug" | "info" | "warning" | "critical";

export interface FormattedEvent {
  timestamp: number;
  data: {
    type: EventType;
    message: string;
    system: string;
    title: string;
  };
}

export interface SecurityData {
  alarm: boolean
  logs: {
    [key: string]: DoorEntries
  }
}

export type BuildingStatus = 'open' | 'closed' | 'unknown'
export type ArmStatus = 'Armed' | 'Disarmed' | 'Partially armed' | 'Unknown'
