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
import { SecurityData, DoorEntries, DoorValues, LogStatus, FormattedEvent } from './types'

export interface Alarm {
  name: string;
  externalID: string;
  playing: boolean;
  building: string;
  state: string;
  ipAddress?: string;
  port: number;
  macAddress?: string;
  temperature?: number;
  voltage?: number;
  frequency?: number;
  expectedSecondsUpdated: number;
  lastUpdated: Date;
  cooldownUntil?: Date;
  autoTurnOffSeconds?: number; // Individual timeout setting (0 = no timeout)
}

export interface MotionZone {
  id: string;
  name: string;
  points: [number, number][];
  minContourArea: number;
  thresholdPercent: number;
}

export interface Camera {
  externalID: string;
  name: string;
  building: string;
  motionDetectionEnabled: boolean;
  mog2History: number;
  mog2VarThreshold: number;
  mog2DetectShadows: boolean;
  motionZones: MotionZone[];
  expectedSecondsUpdated: number;
  lastUpdated: Date;
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

// Unified schedule schema - every schedule now contains both arm and disarm configurations
export type schedule = {
  id: string
  name: string
  sensorIDs: string[]
  createdAt: Date
} & (
  | {
      type: 'recurring'
      armTime: string // "21:00" format
      armDayOffset: number // 0 = same day, 1 = next day
      disarmTime: string // "07:00" format
      disarmDayOffset: number // 0 = same day as creation, 1 = next day
      recurrence: 'Daily' | 'Weekly'
      days?: string[] // Only for Weekly: ['Monday', 'Wednesday', 'Friday']
      active: boolean
      lastModified: Date
    }
  | {
      type: 'oneTime'
      armDateTime: Date // When to arm sensors
      disarmDateTime: Date // When to disarm sensors
    }
)

interface SocketDataProps {
  children: ReactNode
}

type Data = SecurityData

function formatData(sensors: doorSensor[], alarms: Alarm[], cameras: Camera[]): Data {
  const logs: {
    [building: string]: DoorEntries
  } = {}

  // Initialize buildings from cameras (ensures buildings with only cameras appear)
  for (const camera of cameras) {
    if (!logs[camera.building]) {
      logs[camera.building] = {}
    }
  }

  // Initialize buildings from alarms
  for (const alarm of alarms) {
    if (!logs[alarm.building]) {
      logs[alarm.building] = {}
    }
  }

  // Get and sync sensor order from localStorage
  let sensorOrder: {
    buildingOrder: string[]
    sensorsInBuildings: { [building: string]: string[] }
  } = {
    buildingOrder: [],
    sensorsInBuildings: {},
  }

  if (typeof window !== 'undefined') {
    const savedOrder = localStorage.getItem('sensorOrder')
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder)
        // Handle backward compatibility - old format was { [building: string]: string[] }
        if (Array.isArray(parsed.buildingOrder) && parsed.sensorsInBuildings) {
          // New format
          sensorOrder = parsed
        } else {
          // Old format - convert to new format
          const buildingOrder = Object.keys(parsed)
          const sensorsInBuildings = parsed
          sensorOrder = { buildingOrder, sensorsInBuildings }
          // Save in new format
          localStorage.setItem('sensorOrder', JSON.stringify(sensorOrder))
        }
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

  // Process buildings in the specified order
  const orderedBuildings =
    sensorOrder.buildingOrder.length > 0
      ? sensorOrder.buildingOrder.filter(
          (building) => sensorsByBuilding[building]
        )
      : Object.keys(sensorsByBuilding)

  // Add any buildings not in the order to the end
  const remainingBuildings = Object.keys(sensorsByBuilding).filter(
    (building) => !orderedBuildings.includes(building)
  )
  const allBuildings = [...orderedBuildings, ...remainingBuildings]

  // Process each building in order and apply sensor ordering
  for (const building of allBuildings) {
    const buildingSensors = sensorsByBuilding[building]
    if (!buildingSensors) continue

    logs[building] = {}

    // Get the sensor order for this building, if it exists
    const orderedSensorNames = sensorOrder.sensorsInBuildings[building] || []

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
  }
}

// Helper function to sync sensor order (similar to useSensorOrder hook logic)
function syncSensorOrderInFormatData(
  sensors: doorSensor[],
  existingOrder: {
    buildingOrder: string[]
    sensorsInBuildings: { [building: string]: string[] }
  }
): {
  buildingOrder: string[]
  sensorsInBuildings: { [building: string]: string[] }
} {
  // Create current sensor mapping by building
  const currentSensorsByBuilding: { [building: string]: string[] } = {}
  sensors.forEach((sensor) => {
    if (!currentSensorsByBuilding[sensor.building]) {
      currentSensorsByBuilding[sensor.building] = []
    }
    currentSensorsByBuilding[sensor.building].push(sensor.name)
  })

  // Get existing order
  const existingBuildingOrder = existingOrder.buildingOrder || []
  const existingSensorsInBuildings = existingOrder.sensorsInBuildings || {}
  let needsUpdate = false

  // Sync building order
  const currentBuildings = Object.keys(currentSensorsByBuilding)
  const validExistingBuildings = existingBuildingOrder.filter((building) =>
    currentBuildings.includes(building)
  )
  const newBuildings = currentBuildings.filter(
    (building) => !existingBuildingOrder.includes(building)
  )
  const newBuildingOrder = [...validExistingBuildings, ...newBuildings]

  if (
    JSON.stringify(newBuildingOrder) !== JSON.stringify(existingBuildingOrder)
  ) {
    needsUpdate = true
  }

  // Process sensors in each building
  const newSensorsInBuildings: { [building: string]: string[] } = {}
  Object.keys(currentSensorsByBuilding).forEach((building) => {
    const currentSensors = currentSensorsByBuilding[building]
    const existingSensors = existingSensorsInBuildings[building] || []

    // Start with existing order, filtering out sensors that no longer exist
    const validExistingSensors = existingSensors.filter((sensorName) =>
      currentSensors.includes(sensorName)
    )

    // Add any new sensors that aren't in the existing order
    const newSensors = currentSensors.filter(
      (sensorName) => !existingSensors.includes(sensorName)
    )

    // Combine: existing valid sensors + new sensors in their original order
    newSensorsInBuildings[building] = [...validExistingSensors, ...newSensors]

    // Check if this building's sensor order changed
    if (
      !existingSensorsInBuildings[building] ||
      JSON.stringify(newSensorsInBuildings[building]) !==
        JSON.stringify(existingSensorsInBuildings[building])
    ) {
      needsUpdate = true
    }
  })

  // Remove buildings that no longer have sensors
  Object.keys(existingSensorsInBuildings).forEach((building) => {
    if (!currentSensorsByBuilding[building]) {
      needsUpdate = true
    }
  })

  // Update localStorage if changes detected
  const newOrder = {
    buildingOrder: newBuildingOrder,
    sensorsInBuildings: newSensorsInBuildings,
  }

  if (needsUpdate) {
    try {
      localStorage.setItem('sensorOrder', JSON.stringify(newOrder))
      // Don't dispatch event here to avoid infinite loops - this function is called during formatting
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
  cameras: Camera[]
  socket: any | null
  notifications: FormattedEvent[]
  dismissNotification: (timestamp: number) => void
  clearAllNotifications: () => void
}

const SocketDataContext = createContext<SocketDataContextProps>({
  data: {} as Data,
  schedules: [],
  isConnected: false,
  sensors: [],
  alarms: [],
  cameras: [],
  socket: null,
  notifications: [],
  dismissNotification: () => {},
  clearAllNotifications: () => {},
})

export const useSocketData = (): SocketDataContextProps =>
  useContext(SocketDataContext)

export const SocketDataProvider: React.FC<SocketDataProps> = ({ children }) => {
  const [data, setData] = useState<Data>({} as Data)
  const [schedules, setSchedules] = useState<schedule[]>([])
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [sensors, setSensors] = useState<doorSensor[]>([])
  const [alarms, setAlarms] = useState<Alarm[]>([])
  const [cameras, setCameras] = useState<Camera[]>([])
  const [notifications, setNotifications] = useState<FormattedEvent[]>([])
  const { socket } = useSocket() // Assuming you have a custom hook to get the socket instance
  const router = useRouter()

  // Function to dismiss a notification
  const dismissNotification = (timestamp: number) => {
    setNotifications((prev) => prev.filter((notification) => notification.timestamp !== timestamp))
  }

  // Function to clear all notifications
  const clearAllNotifications = () => {
    setNotifications([])
  }

  // Function to reformat data (useful when sensor order changes)
  const reformatData = () => {
    if (sensors.length > 0 || alarms.length > 0 || cameras.length > 0) {
      const formattedData = formatData(sensors, alarms, cameras)
      setData(formattedData)
    }
  }

  useEffect(() => {
    console.log('Socket instance:', socket)
    function onConnect() {
      console.log('Socket connected!')
      setIsConnected(true)
    }

    function onDisconnect() {
      setIsConnected(false)
      router.push('/')
    }

    function onData(value: {
      sensors?: doorSensor[]
      alarms?: Alarm[]
      cameras?: Camera[]
      schedules?: schedule[]
    }) {
      console.log('Socket received data:', value)
      const formattedData = formatData(value.sensors || [], value.alarms || [], value.cameras || [])
      console.log('Formatted data:', formattedData)
      setData(formattedData)
      setSensors(value.sensors || [])
      setAlarms(value.alarms || [])
      setCameras(value.cameras || [])
      if (value.schedules) {
        setSchedules(value.schedules)
      }
    }

    function onEvent(event: FormattedEvent) {
      setNotifications((prev) => [event, ...prev])
    }

    if (socket) {
      console.log('Attaching socket listeners...')
      socket.on('connect', onConnect)
      socket.on('disconnect', onDisconnect)
      socket.on('data', onData)
      socket.on('event', onEvent)
    } else {
      console.log('Socket is null/undefined')
    }

    return () => {
      if (socket) {
        socket.off('connect', onConnect)
        socket.off('disconnect', onDisconnect)
        socket.off('data', onData)
        socket.off('event', onEvent)
      }
    }
  }, [socket])

  // Listen for localStorage changes to sensor order
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sensorOrder') {
        // Reformat data when sensor order changes
        reformatData()
      }
    }

    // Listen for storage events (when localStorage is changed in another tab/component)
    window.addEventListener('storage', handleStorageChange)

    // Also listen for a custom event for same-page localStorage changes
    const handleCustomStorageChange = () => {
      reformatData()
    }
    window.addEventListener('sensorOrderChanged', handleCustomStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener(
        'sensorOrderChanged',
        handleCustomStorageChange
      )
    }
  }, [sensors, alarms])

  return (
    <SocketDataContext.Provider
      value={{
        data,
        schedules: schedules || [],
        isConnected,
        sensors,
        alarms,
        cameras,
        socket,
        notifications,
        dismissNotification,
        clearAllNotifications,
      }}
    >
      {children}
    </SocketDataContext.Provider>
  )
}
