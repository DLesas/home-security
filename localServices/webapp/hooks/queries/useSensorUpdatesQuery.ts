import { useQuery } from '@tanstack/react-query'
import { useSocket } from '@/app/socketInitializer'

export interface SensorUpdate {
  id: number
  sensorId: string
  state: 'open' | 'closed' | 'unknown'
  temperature: string | null
  voltage: string | null
  frequency: number | null
  dateTime: string | null
}

export interface SensorUpdatesResponse {
  status: string
  limit: number
  offset: number
  count: number
  updates: SensorUpdate[]
}

const fetchSensorUpdates = async (
  url: string,
  sensorId: string,
  limit: number = 100,
  offset: number = 0,
  state?: 'open' | 'closed' | 'unknown'
): Promise<SensorUpdatesResponse> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  })

  if (state) {
    params.append('state', state)
  }

  const response = await fetch(
    `${url}/api/v1/sensors/${sensorId}/updates?${params.toString()}`
  )
  if (!response.ok) {
    throw new Error('Failed to fetch sensor updates')
  }
  return response.json()
}

export const useSensorUpdatesQuery = (
  sensorId: string,
  limit: number = 100,
  offset: number = 0,
  state?: 'open' | 'closed' | 'unknown',
  enabled: boolean = true
) => {
  const { url } = useSocket()

  return useQuery<SensorUpdatesResponse, Error>({
    queryKey: ['sensorUpdates', sensorId, limit, offset, state],
    queryFn: () => fetchSensorUpdates(url!, sensorId, limit, offset, state),
    enabled: !!url && !!sensorId && enabled,
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}
