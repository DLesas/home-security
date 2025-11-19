'use client'

import { Card, CardHeader, CardBody } from '@nextui-org/card'
import { Button } from '@nextui-org/button'
import { useDisclosure } from '@nextui-org/modal'
import { IoThermometer, IoRadio } from 'react-icons/io5'
import { MdElectricBolt, MdInfoOutline, MdAccessTime } from 'react-icons/md'
import { TelemetryInfoSheet } from './TelemetryInfoSheet'

interface SensorTelemetryCardProps {
  temperature?: number
  voltage?: number
  frequency?: number
  expectedSecondsUpdated: number
}

interface TelemetryMetric {
  icon: React.ReactNode
  label: string
  value: string
}

export function SensorTelemetryCard({
  temperature,
  voltage,
  frequency,
  expectedSecondsUpdated,
}: SensorTelemetryCardProps) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure()

  const metrics: TelemetryMetric[] = [
    {
      icon: <IoThermometer className="text-sm" />,
      label: 'Temperature',
      value: temperature !== undefined ? `${temperature}°C` : 'N/A',
    },
    {
      icon: <MdElectricBolt className="text-sm" />,
      label: 'Voltage',
      value: voltage !== undefined ? `${voltage}V` : 'N/A',
    },
    {
      icon: <IoRadio className="text-sm" />,
      label: 'Frequency',
      value: frequency !== undefined ? `${(frequency / 1000000).toFixed(0)}MHz` : 'N/A',
    },
    {
      icon: <MdAccessTime className="text-sm" />,
      label: 'Ping Interval',
      value: `${expectedSecondsUpdated}s`,
    },
  ]

  return (
    <>
      <Card className="mb-4 shadow-md sm:mb-6">
        <CardHeader className="pb-2 flex justify-between items-center">
          <h2 className="text-base font-volkorn font-semibold">Telemetry</h2>
          <Button
            isIconOnly
            variant="light"
            size="sm"
            onPress={onOpen}
            className="text-gray-500"
          >
            <MdInfoOutline className="text-xl" />
          </Button>
        </CardHeader>
        <CardBody className="pt-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map((metric, index) => (
              <div key={index}>
                <div className="flex items-center gap-1 text-xs text-default-600 mb-1">
                  {metric.icon}
                  <span>{metric.label}</span>
                </div>
                <div className="text-sm font-medium text-default-400">
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <TelemetryInfoSheet isOpen={isOpen} onOpenChange={onOpenChange} />
    </>
  )
}
