'use client'

import { useMemo } from 'react'
import { Card, CardHeader, CardBody } from '@nextui-org/card'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useSensorUpdatesQuery } from '../../../hooks/queries/useSensorUpdatesQuery'

interface SensorActivityGraphProps {
  sensorId: string
}

export function SensorActivityGraph({ sensorId }: SensorActivityGraphProps) {
  // Fetch all 'open' events for the graph
  const { data: openEventsData, isLoading } = useSensorUpdatesQuery(
    sensorId,
    1000, // Large limit to get all opens for the day
    0,
    'open',
    !!sensorId
  )

  const openEvents = openEventsData?.updates || []

  // Process data for 24-hour cumulative graph
  const chartData = useMemo(() => {
    // Filter events from the last 24 hours
    const now = new Date()
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const recentOpens = openEvents
      .filter(update => update.dateTime && new Date(update.dateTime) >= last24Hours)
      .map(update => new Date(update.dateTime!))
      .sort((a, b) => a.getTime() - b.getTime())

    // Create 24 hour bins (one for each hour)
    const hourBins: { hour: string, count: number, cumulativeCount: number }[] = []
    let cumulativeCount = 0

    for (let i = 0; i < 24; i++) {
      const hourStart = new Date(last24Hours.getTime() + i * 60 * 60 * 1000)
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)

      // Count opens in this hour
      const opensInHour = recentOpens.filter(
        openTime => openTime >= hourStart && openTime < hourEnd
      ).length

      cumulativeCount += opensInHour

      hourBins.push({
        hour: hourStart.getHours().toString().padStart(2, '0') + ':00',
        count: opensInHour,
        cumulativeCount: cumulativeCount
      })
    }

    return hourBins
  }, [openEvents])

  // Don't render if loading or no data
  if (isLoading || !openEventsData) {
    return null
  }

  // Check if there's any activity to show
  const hasActivity = chartData.some(bin => bin.cumulativeCount > 0)

  if (!hasActivity) {
    return null
  }

  return (
    <Card className="mb-4 shadow-md sm:mb-6">
      <CardHeader className="pb-2">
        <h2 className="text-base font-volkorn font-semibold">24-Hour Activity</h2>
      </CardHeader>
      <CardBody className="pt-2">
        <div className="w-full h-64">
          {chartData && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} key={`chart-${sensorId}`}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 12 }}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ fontWeight: 600 }}
                  formatter={(value: number, name: string) => [
                    value,
                    name === 'cumulativeCount' ? 'Total Opens' : 'Opens'
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativeCount"
                  stroke="#f31260"
                  fill="#f31260"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Cumulative count of door opens over the last 24 hours
        </p>
      </CardBody>
    </Card>
  )
}
