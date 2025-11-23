import { useMutation } from '@tanstack/react-query'
import { useSocket } from '../../app/socketInitializer'

export const useTestAlarmMutation = () => {
  const { url } = useSocket()

  return useMutation({
    mutationFn: async (alarmId: string) => {
      const response = await fetch(`${url}/api/v1/alarms/${alarmId}/test`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to test alarm')
      return response.json()
    },
  })
}
