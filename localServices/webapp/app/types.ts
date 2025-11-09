export type LogStatus = 'open' | 'closed' | 'unknown'

export interface DoorValues {
  status: LogStatus
  armed: boolean
}

export interface DoorEntries {
  [key: string]: DoorValues
}

export interface Issue {
  msg: string
  time: Date
  id: string
}

export interface SecurityData {
  alarm: boolean
  logs: {
    [key: string]: DoorEntries
  }
  issues: Issue[]
}

export type BuildingStatus = 'open' | 'closed' | 'unknown'
export type ArmStatus = 'Armed' | 'Disarmed' | 'Partially armed' | 'Unknown'
