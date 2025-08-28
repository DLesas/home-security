import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSocket } from "~/providers/socketProvider";

// Toggle to inject dummy data during development
const INJECT_DUMMY_DATA = true;

type DoorSensor = {
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
  lastUpdated: string | Date;
};

type Alarm = {
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
  lastUpdated: string | Date;
};

type DoorEntries = {
  [sensorName: string]: {
    status: string;
    armed: boolean;
  };
};

export type Schedule = {
  name: string;
  building: string;
  action: "Arm" | "Disarm";
  date?: string;
  time: string;
  days?: (
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday"
    | "Sunday"
  )[];
  recurrence: "Daily" | "Weekly" | "One off";
};

type DataShape = {
  alarm: boolean;
  logs: { [building: string]: DoorEntries };
  issues: { msg: string; time: string | Date; id: string }[] | [];
};

function formatData(sensors: DoorSensor[], alarms: Alarm[]): DataShape {
  const logs: { [building: string]: DoorEntries } = {};
  for (const sensor of sensors) {
    if (!logs[sensor.building]) logs[sensor.building] = {};
    logs[sensor.building][sensor.name] = {
      status: sensor.state,
      armed: sensor.armed,
    };
  }
  return {
    alarm: alarms.some((a) => a.playing),
    logs,
    issues: [],
  };
}

type SocketDataContextType = {
  data: DataShape;
  schedules: Schedule[];
  isConnected: boolean;
  sensors: DoorSensor[];
  alarms: Alarm[];
};

const SocketDataContext = createContext<SocketDataContextType | undefined>(
  undefined
);

export function useSocketData() {
  const ctx = useContext(SocketDataContext);
  if (!ctx)
    throw new Error("useSocketData must be used within SocketDataProvider");
  return ctx;
}

function makeDummyData(): {
  sensors: DoorSensor[];
  alarms: Alarm[];
  schedules: Schedule[];
} {
  const sensors: DoorSensor[] = [
    {
      name: "Front Door",
      externalID: "sensor-front",
      building: "House",
      armed: true,
      state: "closed",
      temperature: 22.1,
      expectedSecondsUpdated: 60,
      lastUpdated: new Date().toISOString(),
    },
    {
      name: "Back Door",
      externalID: "sensor-back",
      building: "House",
      armed: false,
      state: "open",
      temperature: 23.5,
      expectedSecondsUpdated: 60,
      lastUpdated: new Date().toISOString(),
    },
    {
      name: "Front Door",
      externalID: "sensor-front",
      building: "Yard",
      armed: true,
      state: "closed",
      temperature: 22.1,
      expectedSecondsUpdated: 60,
      lastUpdated: new Date().toISOString(),
    },
  ];
  const alarms: Alarm[] = [
    {
      name: "Siren",
      externalID: "alarm-1",
      playing: false,
      building: "House",
      expectedSecondsUpdated: 60,
      lastUpdated: new Date().toISOString(),
    },
  ];
  const schedules: Schedule[] = [
    {
      name: "Arm at night",
      building: "House",
      action: "Arm",
      time: "22:00",
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      recurrence: "Weekly",
    },
  ];
  return { sensors, alarms, schedules };
}

export function SocketDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { socket } = useSocket();
  const [data, setData] = useState<DataShape>({
    alarm: false,
    logs: {},
    issues: [],
  });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [sensors, setSensors] = useState<DoorSensor[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }
    function onDisconnect() {
      setIsConnected(false);
    }
    function onData(value: { sensors: DoorSensor[]; alarms: Alarm[] }) {
      if (INJECT_DUMMY_DATA) {
        const { sensors: ds, alarms: al } = makeDummyData();
        setSensors(ds);
        setAlarms(al);
        setData(formatData(ds, al));
        return;
      }
      setSensors(value.sensors);
      setAlarms(value.alarms);
      setData(formatData(value.sensors, value.alarms));
    }
    function onSchedules(value: Schedule[]) {
      setSchedules(value);
    }

    if (socket) {
      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      socket.on("data", onData);
      socket.on("schedules", onSchedules);
    }
    return () => {
      if (socket) {
        socket.off("connect", onConnect);
        socket.off("disconnect", onDisconnect);
        socket.off("data", onData);
        socket.off("schedules", onSchedules);
      }
    };
  }, [socket]);

  const value = useMemo(
    () => ({ data, schedules, isConnected, sensors, alarms }),
    [data, schedules, isConnected, sensors, alarms]
  );

  return (
    <SocketDataContext.Provider value={value}>
      {children}
    </SocketDataContext.Provider>
  );
}
