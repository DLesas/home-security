import { useMutation } from '@tanstack/react-query'
import { useSocket } from '../../app/socketInitializer'
import type {
  CameraProtocol,
  CameraUpdatePayload,
} from '@/shared/camera'

export type CameraCreatePayload = Required<
  Pick<CameraUpdatePayload, 'name' | 'building'>
> &
  Omit<CameraUpdatePayload, 'name' | 'building' | 'motionZones'> & {
  ipAddress: string
  port: number
  protocol: CameraProtocol
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
