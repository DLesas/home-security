'use client'

// components/SocketInitializer.tsx
import React, { useEffect, useState, ReactNode } from 'react'
import { createSocket } from '../../lib/socket'
import { Socket } from 'socket.io-client'
import { DefaultEventsMap } from 'socket.io/dist/typed-events'

interface SocketInitializerProps {
  children: ReactNode
}

interface SocketContextType {
  socket: Socket<DefaultEventsMap, DefaultEventsMap> | null
  setUrl: React.Dispatch<React.SetStateAction<string | null>>
  url: string | null
}

export const SocketContext = React.createContext<SocketContextType | undefined>(undefined)

export function useSocket() {
  const context = React.useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

const SocketInitializer: React.FC<SocketInitializerProps> = ({ children }) => {
  const defaultUrl = 'http://localhost:8080'
  const [socket, setSocket] = useState<Socket<DefaultEventsMap, DefaultEventsMap> | null>(null)
  const [url, setUrl] = useState<string | null>(defaultUrl)

  const initializeSocket = (socketUrl: string) => {
    console.log('got socket', socketUrl)
    const newSocket = createSocket(socketUrl)
    setSocket(newSocket)
    return () => {
      newSocket.close()
    }
  }

  useEffect(() => {
    const socketUrl = url
    if (!socketUrl) {
      console.log('no socket')
    } else {
      initializeSocket(socketUrl)
    }
  }, [url])


  return (
    <SocketContext.Provider value={{ socket, setUrl, url }}>
      {children}
    </SocketContext.Provider>
  )
}

export default SocketInitializer
