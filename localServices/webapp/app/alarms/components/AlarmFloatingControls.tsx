'use client'

import { Button } from '@nextui-org/button'
import { useDisclosure } from '@nextui-org/modal'
import { useTestAlarmMutation } from '../../../hooks/mutations/useAlarmMutations'
import { ArmWarningModal } from '../../home/components/ArmWarningModal'

interface AlarmFloatingControlsProps {
  alarmId: string
  alarmName: string
}

export function AlarmFloatingControls({ alarmId, alarmName }: AlarmFloatingControlsProps) {
  const testMutation = useTestAlarmMutation()
  const { isOpen, onOpen, onOpenChange } = useDisclosure()

  return (
    <>
      <div className="fixed bottom-6 left-0 right-0 px-4 z-10">
        <div className="container mx-auto max-w-4xl">
          <Button
            color="danger"
            size="lg"
            className="w-full shadow-lg"
            isLoading={testMutation.isPending}
            onPress={onOpen}
          >
            Test Alarm
          </Button>
        </div>
      </div>

      <ArmWarningModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        title="Test alarm?"
        message={`This will briefly sound ${alarmName}. Are you sure you want to continue?`}
        onConfirm={() => testMutation.mutate(alarmId)}
        onCancel={() => {}}
        confirmText="Test alarm"
      />
    </>
  )
}
