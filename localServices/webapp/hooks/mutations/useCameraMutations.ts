import { useMutation } from '@tanstack/react-query'
import { useSocket } from '../../app/socketInitializer'
import { MotionZone, DetectionModel, ModelSettings } from '../../app/socketData'

export interface CameraUpdatePayload {
  name?: string
  building?: string
  targetWidth?: number
  targetHeight?: number
  motionDetectionEnabled?: boolean
  // Detection model and settings
  detectionModel?: DetectionModel
  modelSettings?: ModelSettings
  motionZones?: MotionZone[]
  // FPS caps (optional - acts as maximum, never upscales)
  maxStreamFps?: number
  maxRecordingFps?: number
  // JPEG encoding quality (1-100, where 100=best quality)
  jpegQuality?: number
}

export const useUpdateCameraMutation = () => {
  const { url } = useSocket()

  return useMutation({
    mutationFn: async ({ cameraId, updates }: { cameraId: string; updates: CameraUpdatePayload }) => {
      const response = await fetch(`${url}/api/v1/cameras/${cameraId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
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
