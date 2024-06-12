'use client'

// components/SocketInitializer.tsx
import React, { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createSocket } from '@/lib/socket'
import { Socket } from 'socket.io-client'
import { DefaultEventsMap } from 'socket.io/dist/typed-events'

interface SocketInitializerProps {
  children: ReactNode
}

interface SocketContextType {
  socket: Socket<DefaultEventsMap, DefaultEventsMap> | null
  setUrl: React.Dispatch<React.SetStateAction<string | null>>
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
  const [socket, setSocket] = useState<Socket<DefaultEventsMap, DefaultEventsMap> | null>(null)
  const router = useRouter()
  const [url, setUrl] = useState<string | null>(null)

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
      router.push('/') // Redirect to the input page if no socket URL is found
    } else {
      initializeSocket(socketUrl)
    }
  }, [url, router])


  return (
    <SocketContext.Provider value={{ socket, setUrl }}>
      {children}
    </SocketContext.Provider>
  )
}

export default SocketInitializer
