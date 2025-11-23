'use client'

import { useParams, useRouter } from 'next/navigation'
import { useSocketData } from '../../socketData'
import { Button } from '@nextui-org/button'
import { AlarmHeader } from '../components/AlarmHeader'
import { AlarmTelemetryCard } from '../components/AlarmTelemetryCard'
import { AlarmRecentActivityCard } from '../components/AlarmRecentActivityCard'
import { AlarmFloatingControls } from '../components/AlarmFloatingControls'

export default function AlarmDetail() {
  const params = useParams()
  const router = useRouter()
  const { alarms } = useSocketData()

  const alarmId = params.alarmId as string
  const alarm = alarms.find((a) => a.externalID === alarmId)

  if (!alarm) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-volkorn font-bold">Alarm Not Found</h1>
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
        <AlarmHeader
          alarmName={alarm.name}
          buildingName={alarm.building}
          playing={alarm.playing}
          state={alarm.state}
          lastUpdated={alarm.lastUpdated}
        />

        <AlarmTelemetryCard
          temperature={alarm.temperature}
          voltage={alarm.voltage}
          frequency={alarm.frequency}
          expectedSecondsUpdated={alarm.expectedSecondsUpdated}
          autoTurnOffSeconds={alarm.autoTurnOffSeconds}
          cooldownUntil={alarm.cooldownUntil}
        />

        <AlarmRecentActivityCard alarmId={alarmId} />
      </div>

      <AlarmFloatingControls
        alarmId={alarmId}
        alarmName={alarm.name}
      />
    </>
  )
}
