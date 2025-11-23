'use client'

import { Button } from '@nextui-org/button'
import { useTestAlarmMutation } from '../../../hooks/mutations/useAlarmMutations'

interface AlarmFloatingControlsProps {
  alarmId: string
  alarmName: string
}

export function AlarmFloatingControls({ alarmId, alarmName }: AlarmFloatingControlsProps) {
  const testMutation = useTestAlarmMutation()

  return (
    <div className="fixed bottom-6 left-0 right-0 px-4 z-10">
      <div className="container mx-auto max-w-4xl">
        <Button
          color="danger"
          size="lg"
          className="w-full shadow-lg"
          isLoading={testMutation.isPending}
          onPress={() => testMutation.mutate(alarmId)}
        >
          Test Alarm
        </Button>
      </div>
    </div>
  )
}
