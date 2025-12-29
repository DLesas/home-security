import { useEffect, useState, useRef } from 'react'
import { useSocketData } from '../app/socketData'

export interface CameraStats {
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
  decodeMs: number
  encodeMs: number
  decoderType: string
  encoderType: string
}

export interface MotionData {
  camera_id: string
  timestamp: number
  motion_detected: boolean
  processing_time_ms: number
  zone_results: Array<{
    zone_id: string
    zone_name: string
    has_motion: boolean
    motion_percentage: number
    motion_regions: number
    total_motion_pixels: number
  }>
  mask: string // base64 encoded JPEG
}

interface UseCameraStreamOptions {
  cameraId: string
  enabled?: boolean
}

interface UseCameraStreamResult {
  frame: string | null
  stats: CameraStats | null
  clientFps: number
  isConnected: boolean
  motionMask: string | null
  motionData: MotionData | null
}

export function useCameraStream({ cameraId, enabled = true }: UseCameraStreamOptions): UseCameraStreamResult {
  const { socket } = useSocketData()
  const [frame, setFrame] = useState<string | null>(null)
  const [stats, setStats] = useState<CameraStats | null>(null)
  const [clientFps, setClientFps] = useState<number>(0)
  const [motionMask, setMotionMask] = useState<string | null>(null)
  const [motionData, setMotionData] = useState<MotionData | null>(null)
  const frameTimestamps = useRef<number[]>([])
  // Track the currently subscribed cameraId to prevent double subscribe/unsubscribe
  const subscribedCameraId = useRef<string | null>(null)

  // Separate effect for subscription management - only depends on socket, cameraId, enabled
  useEffect(() => {
    if (!socket || !cameraId || !enabled) {
      // If disabled or no socket, unsubscribe from any existing subscription
      if (subscribedCameraId.current) {
        socket?.emit('unsubscribe:camera', subscribedCameraId.current)
        subscribedCameraId.current = null
      }
      return
    }

    // Only subscribe if not already subscribed to this camera
    if (subscribedCameraId.current !== cameraId) {
      // Unsubscribe from previous camera if any
      if (subscribedCameraId.current) {
        socket.emit('unsubscribe:camera', subscribedCameraId.current)
      }
      socket.emit('subscribe:camera', cameraId)
      subscribedCameraId.current = cameraId
    }

    return () => {
      // Only unsubscribe if we're actually subscribed to this camera
      if (subscribedCameraId.current === cameraId) {
        socket.emit('unsubscribe:camera', cameraId)
        subscribedCameraId.current = null
      }
    }
  }, [socket, cameraId, enabled])

  // Separate effect for event handlers - can re-run without affecting subscription
  useEffect(() => {
    if (!socket || !cameraId || !enabled) return

    const handleFrame = (data: { cameraId: string; frame: ArrayBuffer | string }) => {
      if (data.cameraId !== cameraId) return

      const now = performance.now()

      // Track frame timestamps for FPS calculation (keep last 1 second)
      frameTimestamps.current.push(now)
      const oneSecondAgo = now - 1000
      while (frameTimestamps.current.length > 0 && frameTimestamps.current[0] < oneSecondAgo) {
        frameTimestamps.current.shift()
      }

      // Calculate FPS inline to avoid dependency
      const timestamps = frameTimestamps.current
      if (timestamps.length >= 2) {
        const windowMs = timestamps[timestamps.length - 1] - timestamps[0]
        if (windowMs > 0) {
          setClientFps(((timestamps.length - 1) / windowMs) * 1000)
        }
      }

      // Convert frame to base64
      let base64: string
      if (typeof data.frame === 'string') {
        base64 = data.frame
      } else {
        const bytes = new Uint8Array(data.frame)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        base64 = btoa(binary)
      }
      setFrame(base64)
    }

    const handleStats = (data: CameraStats) => {
      if (data.cameraId !== cameraId) return
      setStats(data)
    }

    const handleMotion = (data: MotionData) => {
      if (data.camera_id !== cameraId) return
      setMotionData(data)
      // Only set mask if it's not empty
      if (data.mask && data.mask.length > 0) {
        setMotionMask(data.mask)
      }
    }

    socket.on('camera:frame', handleFrame)
    socket.on('camera:stats', handleStats)
    socket.on('motion', handleMotion)

    return () => {
      socket.off('camera:frame', handleFrame)
      socket.off('camera:stats', handleStats)
      socket.off('motion', handleMotion)
      frameTimestamps.current = []
      setFrame(null)
      setStats(null)
      setClientFps(0)
      setMotionMask(null)
      setMotionData(null)
    }
  }, [socket, cameraId, enabled])

  return {
    frame,
    stats,
    clientFps,
    isConnected: !!frame,
    motionMask,
    motionData,
  }
}
