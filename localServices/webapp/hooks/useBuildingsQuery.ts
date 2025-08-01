import { useQuery } from '@tanstack/react-query'
import { useSocket } from '@/app/socketInitializer'

// Define the building type locally
export interface Building {
  id: string
  name: string | null
  createdAt: string | null
}

const fetchBuildings = async (url: string) => {
  const response = await fetch(`${url}/api/v1/buildings`)
  if (!response.ok) {
    throw new Error('Network response was not ok')
  }
  const data = await response.json()
  return data.data as Building[]
}

export const useBuildingsQuery = () => {
  const { url } = useSocket()
  return useQuery<Building[], Error>({
    queryKey: ['buildings'],
    queryFn: () => fetchBuildings(url!),
    enabled: !!url,
  })
}
