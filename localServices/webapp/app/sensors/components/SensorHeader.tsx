'use client'

import { Card, CardHeader } from '@nextui-org/card'
import { StatusPill } from '../../home/components/StatusPill'
import { LogStatus } from '../../types'

interface SensorHeaderProps {
  sensorName: string
  buildingName: string
  armed: boolean
  state: LogStatus
  lastUpdated?: Date
}

export function SensorHeader({
  sensorName,
  buildingName,
  armed,
  state,
  lastUpdated,
}: SensorHeaderProps) {
  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Never'

    const date = new Date(lastUpdated)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Card className="mb-4 shadow-md sm:mb-6">
      <CardHeader className="pb-2">
        <div className="w-full">
          <h1 className="text-2xl font-volkorn font-bold mb-2">
            {sensorName} <span className="text-default-500 text-lg">({buildingName})</span>
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            {armed && <StatusPill type="armed">Armed</StatusPill>}
            {state === 'open' ? (
              <StatusPill type="open">Open</StatusPill>
            ) : state === 'closed' ? (
              <StatusPill type="closed">Closed</StatusPill>
            ) : (
              <StatusPill type="unknown">Unknown</StatusPill>
            )}
            <span className="text-xs text-default-500">
              Last updated {formatLastUpdated()}
            </span>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}
