'use client'

import { Card, CardHeader, CardBody } from '@nextui-org/card'
import { Chip } from '@nextui-org/chip'
import { MdInfoOutline } from 'react-icons/md'

interface AlarmTelemetryCardProps {
  temperature?: number
  voltage?: number
  frequency?: number
  expectedSecondsUpdated: number
  autoTurnOffSeconds?: number
  cooldownUntil?: Date
}

export function AlarmTelemetryCard({
  temperature,
  voltage,
  frequency,
  expectedSecondsUpdated,
  autoTurnOffSeconds,
  cooldownUntil,
}: AlarmTelemetryCardProps) {
  const formatCooldown = () => {
    if (!cooldownUntil) return 'None'
    const now = new Date()
    const cooldown = new Date(cooldownUntil)
    if (cooldown <= now) return 'None'

    const diffMs = cooldown.getTime() - now.getTime()
    const diffSecs = Math.floor(diffMs / 1000)

    if (diffSecs < 60) return `${diffSecs}s`
    const diffMins = Math.floor(diffSecs / 60)
    return `${diffMins}m ${diffSecs % 60}s`
  }

  return (
    <Card className="mb-4 shadow-md sm:mb-6">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <MdInfoOutline size={20} className="text-default-500" />
          <h2 className="text-lg font-semibold">Telemetry</h2>
        </div>
      </CardHeader>
      <CardBody className="pt-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-default-500 mb-1">Temperature</p>
            <Chip size="sm" variant="flat" color="primary">
              {temperature !== undefined ? `${temperature}°C` : 'N/A'}
            </Chip>
          </div>
          <div>
            <p className="text-xs text-default-500 mb-1">Voltage</p>
            <Chip size="sm" variant="flat" color="primary">
              {voltage !== undefined ? `${voltage}V` : 'N/A'}
            </Chip>
          </div>
          <div>
            <p className="text-xs text-default-500 mb-1">Frequency</p>
            <Chip size="sm" variant="flat" color="primary">
              {frequency !== undefined ? `${frequency} MHz` : 'N/A'}
            </Chip>
          </div>
          <div>
            <p className="text-xs text-default-500 mb-1">Update Interval</p>
            <Chip size="sm" variant="flat" color="secondary">
              {expectedSecondsUpdated}s
            </Chip>
          </div>
          <div>
            <p className="text-xs text-default-500 mb-1">Auto Turn Off</p>
            <Chip size="sm" variant="flat" color="warning">
              {autoTurnOffSeconds === 0 || autoTurnOffSeconds === undefined ? 'Disabled' : `${autoTurnOffSeconds}s`}
            </Chip>
          </div>
          <div>
            <p className="text-xs text-default-500 mb-1">Cooldown</p>
            <Chip size="sm" variant="flat" color="danger">
              {formatCooldown()}
            </Chip>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
