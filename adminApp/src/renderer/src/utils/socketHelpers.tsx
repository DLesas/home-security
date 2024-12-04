type LogStatus = 'open' | 'closed'

interface DoorValues {
  status: LogStatus
  armed: boolean
}

interface DoorEntries {
  [key: string]: DoorValues
}

interface Example {
  alarm: boolean
  logs: {
    [key: string]: DoorEntries | {}
  }
  issues:
    | {
        msg: string
        time: Date
        id: string
      }[]
    | [] // Update to allow for an empty array
}

type Data = Example

export function countDoorEntriesBuilding(
    data: Data,
    building: string
  ): { armed: number; disarmed: number } {
    let armedCount = 0
    let disarmedCount = 0
  
    for (const door in data.logs[building]) {
      // @ts-ignore
      if (data.logs[building][door].armed) {
        armedCount++
      } else {
        disarmedCount++
      }
    }
  
    return { armed: armedCount, disarmed: disarmedCount }
  }
  
  export function checkBuildingOpen(data: Data, building: string) {
    for (const door in data.logs[building]) {
      // @ts-ignore
      if (data.logs[building][door].status == 'open') {
        return 'open' as const
      }
      // @ts-ignore
      if (data.logs[building][door].status == 'unknown') {
        return 'unknown' as const
      }
    }
    return 'closed' as const
  }
  
  export function countDoorEntries(data: Data): { armed: number; disarmed: number } {
    let armedCount = 0
    let disarmedCount = 0
  
    if (data.logs == undefined) {
      return { armed: 0, disarmed: 0 }
    }
    for (const building in data.logs) {
      for (const door in data.logs[building]) {
        // @ts-ignore
        if (data.logs[building][door].armed) {
          armedCount++
        } else {
          disarmedCount++
        }
      }
    }
  
    return { armed: armedCount, disarmed: disarmedCount }
  }
  
  export function checkArmedState({
    armed,
    disarmed,
  }: {
    armed: number
    disarmed: number
  }) {
    if (armed == 0 && disarmed == 0) {
      return 'Unknown'
    } else if (armed > 0 && disarmed > 0) {
      return 'Partially armed'
    } else if (armed > 0 && disarmed == 0) {
      return 'Armed'
    } else if (armed == 0 && disarmed > 0) {
      return 'Disarmed'
    } else {
      return 'Unknown'
    }
  }