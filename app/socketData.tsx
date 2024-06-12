"use client"

import React, { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { useSocket } from './socketInitializer'; // Assuming you have a custom hook to get the socket instance
import { useRouter } from 'next/navigation';


interface SocketDataProps {
    children: ReactNode
  }

type LogStatus = 'open' | 'closed';

interface DoorValues {
  status: LogStatus;
  armed: boolean;
}

interface DoorEntries {
  [key: string]: DoorValues;
}

interface Example {
  alarm: boolean;
  logs: {
    [key: string]: DoorEntries | {};
  };
  issues:
    | {
        msg: string;
        time: Date;
        id: string;
      }[]
    | [];
}

type Data = Example;

interface SocketDataContextProps {
  data: Data;
  isConnected: boolean;
}

const SocketDataContext = createContext<SocketDataContextProps>({
  data: {} as Data,
  isConnected: false,
});

export const useSocketData = (): SocketDataContextProps =>
  useContext(SocketDataContext);

export const SocketDataProvider: React.FC<SocketDataProps> = ({ children }) => {
  const [data, setData] = useState<Data>({} as Data);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const {socket} = useSocket(); // Assuming you have a custom hook to get the socket instance
  const router = useRouter()

  useEffect(() => {
    console.log(socket)
    function onConnect() {
      setIsConnected(true);
      console.log('connected')
    }

    function onDisconnect() {
      setIsConnected(false);
      router.push('/')
    }

    function onData(value: Data) {
      setData(value);
      console.log(value)
    }

    if (socket) {
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('data', onData);
    }

    return () => {
      if (socket) {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('data', onData);
      }
    };
  }, [socket]);

  return (
    <SocketDataContext.Provider value={{ data, isConnected }}>
      {children}
    </SocketDataContext.Provider>
  );
};
