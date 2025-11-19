'use client'

import { useParams, useRouter } from 'next/navigation'
import { useSocketData } from '../../socketData'
import { Button } from '@nextui-org/button'
import { SensorHeader } from '../components/SensorHeader'
import { SensorTelemetryCard } from '../components/SensorTelemetryCard'
import { SensorActivityGraph } from '../components/SensorActivityGraph'
import { RecentActivityCard } from '../components/RecentActivityCard'
import { FloatingControls } from '../components/FloatingControls'

export default function SensorDetail() {
  const params = useParams()
  const router = useRouter()
  const { sensors } = useSocketData()

  const sensorId = params.sensorId as string
  const sensor = sensors.find((s) => s.externalID === sensorId)

  if (!sensor) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-volkorn font-bold">Sensor Not Found</h1>
          <Button color="primary" onPress={() => router.push('/home')}>
            Go Back Home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-8 pb-24">
        <SensorHeader
          sensorName={sensor.name}
          buildingName={sensor.building}
          armed={sensor.armed}
          state={sensor.state}
          lastUpdated={sensor.lastUpdated}
        />

        <SensorTelemetryCard
          temperature={sensor.temperature}
          voltage={sensor.voltage}
          frequency={sensor.frequency}
          expectedSecondsUpdated={sensor.expectedSecondsUpdated}
        />

        <SensorActivityGraph sensorId={sensorId} />

        <RecentActivityCard sensorId={sensorId} />
      </div>

      <FloatingControls
        sensorId={sensorId}
        armed={sensor.armed}
        state={sensor.state}
        sensorName={sensor.name}
      />
    </>
  )
}
