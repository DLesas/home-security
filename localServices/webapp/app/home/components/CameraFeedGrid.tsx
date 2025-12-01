'use client'

import { useEffect, useState, useRef } from 'react'
import { useSocketData, type Camera } from '../../socketData'

interface CameraStats {
  cameraId: string
  cameraName: string
  state: string
  frameCount: number
  fps: number
  avgProcessingMs: number
  jpegQuality: number
  jpegSizeMB: number
  frameFlowState: string
  motionProcessingMs: number | null

  // FFmpeg timing metrics
  decodeMs: number
  encodeMs: number
  decoderType: string
  encoderType: string
}

interface CameraFeedGridProps {
  cameras: Camera[]
  onCameraClick?: (cameraId: string) => void
}

export function CameraFeedGrid({ cameras, onCameraClick }: CameraFeedGridProps) {
  const { socket } = useSocketData()
  const [frames, setFrames] = useState<Map<string, string>>(new Map())
  const [stats, setStats] = useState<Map<string, CameraStats>>(new Map())
  const subscribedCameras = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!socket) return

    // Subscribe to cameras
    const cameraIds = cameras.map(c => c.externalID)
    cameraIds.forEach(id => {
      if (!subscribedCameras.current.has(id)) {
        socket.emit("subscribe:camera", id)
        subscribedCameras.current.add(id)
      }
    })

    // Handle incoming frames
    const handleFrame = (data: { cameraId: string; frame: ArrayBuffer | string }) => {
      // Frame comes as ArrayBuffer from socket.io, convert to base64
      let base64: string
      if (typeof data.frame === 'string') {
        base64 = data.frame
      } else {
        // Convert ArrayBuffer to base64
        const bytes = new Uint8Array(data.frame)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        base64 = btoa(binary)
      }
      setFrames(prev => new Map(prev).set(data.cameraId, base64))
    }

    socket.on("camera:frame", handleFrame)

    // Handle incoming stats
    const handleStats = (data: CameraStats) => {
      setStats(prev => new Map(prev).set(data.cameraId, data))
    }

    socket.on("camera:stats", handleStats)

    // Cleanup: unsubscribe and remove listeners
    return () => {
      socket.off("camera:frame", handleFrame)
      socket.off("camera:stats", handleStats)
      subscribedCameras.current.forEach(id => {
        socket.emit("unsubscribe:camera", id)
      })
      subscribedCameras.current.clear()
    }
  }, [socket, cameras])

  if (cameras.length === 0) return null

  return (
    <div className="mb-4">
      <h4 className="text-xs font-medium text-default-500 mb-2">Cameras</h4>
      <div className="grid grid-cols-2 gap-2">
        {cameras.map(camera => {
          const frame = frames.get(camera.externalID)
          const cameraStats = stats.get(camera.externalID)
          return (
            <div
              key={camera.externalID}
              className="relative aspect-video bg-default-100 rounded-md overflow-hidden cursor-pointer"
              onClick={() => onCameraClick?.(camera.externalID)}
            >
              {frame ? (
                <img
                  src={`data:image/jpeg;base64,${frame}`}
                  alt={camera.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-default-400 text-xs">
                  Loading...
                </div>
              )}
              {/* Top overlay - stats */}
              <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-1">
                {/* Live indicator with FPS */}
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                  frame ? 'bg-red-600/90 text-white' : 'bg-default-300/90 text-default-600'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${frame ? 'bg-white animate-pulse' : 'bg-default-400'}`} />
                  {cameraStats ? `${cameraStats.fps.toFixed(0)} FPS` : (frame ? 'LIVE' : 'OFF')}
                </div>
                {/* Processing times */}
                {cameraStats && (
                  <div className="bg-black/60 text-white px-1.5 py-0.5 rounded text-[9px] flex items-center gap-1">
                    <span>{cameraStats.avgProcessingMs.toFixed(0)}ms</span>
                    {cameraStats.motionProcessingMs !== null && (
                      <span className="text-blue-300">+{cameraStats.motionProcessingMs.toFixed(0)}ms</span>
                    )}
                  </div>
                )}
              </div>
              {/* Bottom overlay - name and quality */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-white text-[10px] font-medium">{camera.name}</span>
                  {cameraStats && (
                    <span className="text-white/80 text-[9px]">
                      Q{cameraStats.jpegQuality}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
