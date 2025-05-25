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
	name: string;
	externalID: string;
	playing: boolean;
	building: string;
	ipAddress?: string;
	macAddress?: string;
	temperature?: number;
	voltage?: number;
	frequency?: number;
	expectedSecondsUpdated: number;
	lastUpdated: Date;
}

interface doorSensor {
  name: string;
  externalID: string;
  building: string;
  armed: boolean;
  state: "open" | "closed" | "unknown";
  ipAddress?: string;
  macAddress?: string;
  temperature?: number;
  voltage?: number;
  frequency?: number;
  expectedSecondsUpdated: number;
  lastUpdated: Date;
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
    status: string;
    armed: boolean;
  };
};

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
    [building: string]: DoorEntries;
  } = {};
  for (const sensor of sensors) {
    if (!logs[sensor.building]) {
      logs[sensor.building] = {}
    }
    logs[sensor.building][sensor.name] = {status: sensor.state, armed: sensor.armed}
  }
  return {
    alarm: alarms.some(alarm => alarm.playing),
    logs: logs,
    issues: []
  }
}

interface SocketDataContextProps {
  data: Data
  schedules: schedule[] | []
  isConnected: boolean
}

const SocketDataContext = createContext<SocketDataContextProps>({
  data: {} as Data,
  schedules: [],
  isConnected: false,
})

export const useSocketData = (): SocketDataContextProps =>
  useContext(SocketDataContext)

export const SocketDataProvider: React.FC<SocketDataProps> = ({ children }) => {
  const [data, setData] = useState<Data>({} as Data)
  const [schedules, setSchedules] = useState([])
  const [isConnected, setIsConnected] = useState<boolean>(false)
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

    function onData(value: {sensors: doorSensor[], alarms: Alarm[]}) {
      const formattedData = formatData(value.sensors, value.alarms)
      setData(formattedData)
      console.log(formattedData)
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
    <SocketDataContext.Provider value={{ data, schedules, isConnected }}>
      {children}
    </SocketDataContext.Provider>
  )
}
