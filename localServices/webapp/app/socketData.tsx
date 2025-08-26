'use client'

import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'
import { useSocket } from './socketInitializer' // Assuming you have a custom hook to get the socket instance
import { useRouter } from 'next/navigation'

interface Alarm {
  name: string
  externalID: string
  playing: boolean
  building: string
  ipAddress?: string
  macAddress?: string
  temperature?: number
  voltage?: number
  frequency?: number
  expectedSecondsUpdated: number
  lastUpdated: Date
}

interface doorSensor {
  name: string
  externalID: string
  building: string
  armed: boolean
  state: 'open' | 'closed' | 'unknown'
  ipAddress?: string
  macAddress?: string
  temperature?: number
  voltage?: number
  frequency?: number
  expectedSecondsUpdated: number
  lastUpdated: Date
}

// {
//   "building": "Shed",
//   "action": "disarm",
//   "date": None,
//   "time": "06:00",
//   "days": ["Monday", "Wednesday", "Friday"],
//   "recurrence": "weekly",
// }

export interface schedule {
  name: string
  building: string
  action: 'Arm' | 'Disarm'
  date?: string
  time: string
  days?: (
    | 'Monday'
    | 'Tuesday'
    | 'Wednesday'
    | 'Thursday'
    | 'Friday'
    | 'Saturday'
    | 'Sunday'
  )[]
  recurrence: 'Daily' | 'Weekly' | 'One off'
}

interface SocketDataProps {
  children: ReactNode
}

type LogStatus = 'open' | 'closed'

interface DoorValues {
  status: LogStatus
  armed: boolean
}

// Define the DoorEntries type with an index signature
type DoorEntries = {
  [sensorName: string]: {
    status: string
    armed: boolean
  }
}

// Initialize logs with the correct type

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
    | []
}

type Data = Example

function formatData(sensors: doorSensor[], alarms: Alarm[]): Data {
  const logs: {
    [building: string]: DoorEntries
  } = {}

  // Get and sync sensor order from localStorage
  let sensorOrder: { [building: string]: string[] } = {}
  if (typeof window !== 'undefined') {
    const savedOrder = localStorage.getItem('sensorOrder')
    if (savedOrder) {
      try {
        sensorOrder = JSON.parse(savedOrder)
      } catch (error) {
        console.error('Failed to parse sensor order from localStorage:', error)
      }
    }

    // Sync sensor order with current sensors (handles first-time, additions, removals)
    sensorOrder = syncSensorOrderInFormatData(sensors, sensorOrder)
  }

  // Group sensors by building first
  const sensorsByBuilding: { [building: string]: doorSensor[] } = {}
  for (const sensor of sensors) {
    if (!sensorsByBuilding[sensor.building]) {
      sensorsByBuilding[sensor.building] = []
    }
    sensorsByBuilding[sensor.building].push(sensor)
  }

  // Process each building and apply ordering
  for (const [building, buildingSensors] of Object.entries(sensorsByBuilding)) {
    logs[building] = {}

    // Get the order for this building, if it exists
    const orderedSensorNames = sensorOrder[building] || []

    // Create a map for quick sensor lookup
    const sensorMap = new Map(
      buildingSensors.map((sensor) => [sensor.name, sensor])
    )

    // First, add sensors in the specified order
    for (const sensorName of orderedSensorNames) {
      const sensor = sensorMap.get(sensorName)
      if (sensor) {
        logs[building][sensor.name] = {
          status: sensor.state,
          armed: sensor.armed,
        }
        sensorMap.delete(sensorName) // Remove from map to avoid duplicates
      }
    }

    // Then add any remaining sensors that weren't in the ordered list
    for (const [sensorName, sensor] of sensorMap) {
      logs[building][sensor.name] = {
        status: sensor.state,
        armed: sensor.armed,
      }
    }
  }

  return {
    alarm: alarms.some((alarm) => alarm.playing),
    logs: logs,
    issues: [],
  }
}

// Helper function to sync sensor order (similar to useSensorOrder hook logic)
function syncSensorOrderInFormatData(
  sensors: doorSensor[],
  existingOrder: { [building: string]: string[] }
): { [building: string]: string[] } {
  // Create current sensor mapping by building
  const currentSensorsByBuilding: { [building: string]: string[] } = {}
  sensors.forEach((sensor) => {
    if (!currentSensorsByBuilding[sensor.building]) {
      currentSensorsByBuilding[sensor.building] = []
    }
    currentSensorsByBuilding[sensor.building].push(sensor.name)
  })

  let needsUpdate = false
  const newOrder: { [building: string]: string[] } = {}

  // Process each building
  Object.keys(currentSensorsByBuilding).forEach((building) => {
    const currentSensors = currentSensorsByBuilding[building]
    const existingSensors = existingOrder[building] || []

    // Start with existing order, filtering out sensors that no longer exist
    const validExistingSensors = existingSensors.filter((sensorName) =>
      currentSensors.includes(sensorName)
    )

    // Add any new sensors that aren't in the existing order
    const newSensors = currentSensors.filter(
      (sensorName) => !existingSensors.includes(sensorName)
    )

    // Combine: existing valid sensors + new sensors in their original order
    newOrder[building] = [...validExistingSensors, ...newSensors]

    // Check if this building's order changed
    if (
      !existingOrder[building] ||
      JSON.stringify(newOrder[building]) !==
        JSON.stringify(existingOrder[building])
    ) {
      needsUpdate = true
    }
  })

  // Remove buildings that no longer have sensors
  Object.keys(existingOrder).forEach((building) => {
    if (!currentSensorsByBuilding[building]) {
      needsUpdate = true
    }
  })

  // Update localStorage if changes detected
  if (needsUpdate) {
    try {
      localStorage.setItem('sensorOrder', JSON.stringify(newOrder))
    } catch (error) {
      console.error('Failed to save updated sensor order:', error)
    }
  }

  return newOrder
}

interface SocketDataContextProps {
  data: Data
  schedules: schedule[] | []
  isConnected: boolean
  sensors: doorSensor[]
  alarms: Alarm[]
}

const SocketDataContext = createContext<SocketDataContextProps>({
  data: {} as Data,
  schedules: [],
  isConnected: false,
  sensors: [],
  alarms: [],
})

export const useSocketData = (): SocketDataContextProps =>
  useContext(SocketDataContext)

export const SocketDataProvider: React.FC<SocketDataProps> = ({ children }) => {
  const [data, setData] = useState<Data>({} as Data)
  const [schedules, setSchedules] = useState([])
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [sensors, setSensors] = useState<doorSensor[]>([])
  const [alarms, setAlarms] = useState<Alarm[]>([])
  const { socket } = useSocket() // Assuming you have a custom hook to get the socket instance
  const router = useRouter()

  useEffect(() => {
    console.log(socket)
    function onConnect() {
      setIsConnected(true)
      console.log('connected')
    }

    function onDisconnect() {
      setIsConnected(false)
      router.push('/')
    }

    function onData(value: { sensors: doorSensor[]; alarms: Alarm[] }) {
      const formattedData = formatData(value.sensors, value.alarms)
      setData(formattedData)
      setSensors(value.sensors)
      setAlarms(value.alarms)
    }

    function onSchedules(value: any) {
      setSchedules(value)
      console.log(value)
    }

    if (socket) {
      socket.on('connect', onConnect)
      socket.on('disconnect', onDisconnect)
      socket.on('data', onData)
      socket.on('schedules', onSchedules)
    }

    return () => {
      if (socket) {
        socket.off('connect', onConnect)
        socket.off('disconnect', onDisconnect)
        socket.off('data', onData)
        socket.off('schedules', onSchedules)
      }
    }
  }, [socket])

  return (
    <SocketDataContext.Provider
      value={{ data, schedules, isConnected, sensors, alarms }}
    >
      {children}
    </SocketDataContext.Provider>
  )
}
