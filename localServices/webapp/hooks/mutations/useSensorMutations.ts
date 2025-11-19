import { useMutation } from '@tanstack/react-query'
import { useSocket } from '../../app/socketInitializer'

export const useArmSensorMutation = () => {
  const { url } = useSocket()

  return useMutation({
    mutationFn: async (sensorId: string) => {
      const response = await fetch(`${url}/api/v1/sensors/${sensorId}/arm`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to arm sensor')
      return response.json()
    },
  })
}

export const useDisarmSensorMutation = () => {
  const { url } = useSocket()

  return useMutation({
    mutationFn: async (sensorId: string) => {
      const response = await fetch(`${url}/api/v1/sensors/${sensorId}/disarm`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to disarm sensor')
      return response.json()
    },
  })
}
