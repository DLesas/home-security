import { useQuery } from '@tanstack/react-query'
import { useSocket } from '@/app/socketInitializer'

export interface AlarmUpdate {
  id: number
  alarmId: string
  playing: boolean
  temperature: string | null
  voltage: string | null
  frequency: number | null
  dateTime: string | null
}

export interface AlarmUpdatesResponse {
  status: string
  limit: number
  offset: number
  count: number
  updates: AlarmUpdate[]
}

const fetchAlarmUpdates = async (
  url: string,
  alarmId: string,
  limit: number = 100,
  offset: number = 0
): Promise<AlarmUpdatesResponse> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  })

  const response = await fetch(
    `${url}/api/v1/alarms/${alarmId}/updates?${params.toString()}`
  )
  if (!response.ok) {
    throw new Error('Failed to fetch alarm updates')
  }
  return response.json()
}

export const useAlarmUpdatesQuery = (
  alarmId: string,
  limit: number = 100,
  offset: number = 0,
  enabled: boolean = true
) => {
  const { url } = useSocket()

  return useQuery<AlarmUpdatesResponse, Error>({
    queryKey: ['alarmUpdates', alarmId, limit, offset],
    queryFn: () => fetchAlarmUpdates(url!, alarmId, limit, offset),
    enabled: !!url && !!alarmId && enabled,
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}
