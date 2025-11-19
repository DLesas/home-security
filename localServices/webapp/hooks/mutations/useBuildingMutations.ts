import { useMutation } from '@tanstack/react-query'
import { useSocket } from '../../app/socketInitializer'
export const useArmBuildingMutation = () => {
  const { url } = useSocket()

  return useMutation({
    mutationFn: async (buildingName: string) => {
      const response = await fetch(`${url}/api/v1/buildings/${buildingName}/arm`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to arm building')
      return response.json()
    },
  })
}

export const useDisarmBuildingMutation = () => {
  const { url } = useSocket()

  return useMutation({
    mutationFn: async (buildingName: string) => {
      const response = await fetch(`${url}/api/v1/buildings/${buildingName}/disarm`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to disarm building')
      return response.json()
    },
  })
}
