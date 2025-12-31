import { useMutation } from '@tanstack/react-query'
import { useSocket } from '../../app/socketInitializer'
import { MotionZone, DetectionModel, ModelSettings, ClassConfig } from '../../app/socketData'

// Base camera settings shared between create and update
interface BaseCameraSettings {
  name?: string
  building?: string
  motionDetectionEnabled?: boolean
  detectionModel?: DetectionModel
  modelSettings?: ModelSettings
  maxStreamFps?: number
  maxRecordingFps?: number
  jpegQuality?: number
  objectDetectionEnabled?: boolean
  classConfigs?: ClassConfig[]
}

export interface CameraUpdatePayload extends BaseCameraSettings {
  targetWidth?: number
  targetHeight?: number
  motionZones?: MotionZone[]
}

export interface CameraCreatePayload extends Required<Pick<BaseCameraSettings, 'name' | 'building'>> , Omit<BaseCameraSettings, 'name' | 'building'> {
  ipAddress: string
  port: number
  protocol: 'udp' | 'rtsp'
  username?: string
  password?: string
  streamPath?: string
}

export const useUpdateCameraMutation = () => {
  const { url } = useSocket()

  return useMutation({
    mutationFn: async ({ cameraId, updates }: { cameraId: string; updates: CameraUpdatePayload }) => {
      const response = await fetch(`${url}/api/v1/cameras/${cameraId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update camera')
      }
      return response.json()
    },
  })
}

export const useCreateCameraMutation = () => {
  const { url } = useSocket()

  return useMutation({
    mutationFn: async (camera: CameraCreatePayload) => {
      const response = await fetch(`${url}/api/v1/cameras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(camera),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create camera')
      }
      return response.json()
    },
  })
}

export const useDeleteCameraMutation = () => {
  const { url } = useSocket()

  return useMutation({
    mutationFn: async (cameraId: string) => {
      const response = await fetch(`${url}/api/v1/cameras/${cameraId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to delete camera')
      }
      return response.json()
    },
  })
}
