'use client'

import { ArmDisarmButtons } from '../../../components/ArmDisarmButtons'
import { useArmSensorMutation, useDisarmSensorMutation } from '../../../hooks/mutations/useSensorMutations'

interface FloatingControlsProps {
  sensorId: string
  armed: boolean
  state: 'open' | 'closed' | 'unknown'
  sensorName: string
}

export function FloatingControls({ sensorId, armed, state, sensorName }: FloatingControlsProps) {
  const armMutation = useArmSensorMutation()
  const disarmMutation = useDisarmSensorMutation()

  return (
    <div className="fixed bottom-6 left-0 right-0 px-4 z-10">
      <div className="container mx-auto max-w-4xl">
        <ArmDisarmButtons
          isArmed={armed}
          currentState={state}
          entityName={sensorName}
          armLoading={armMutation.isPending}
          disarmLoading={disarmMutation.isPending}
          onArm={() => armMutation.mutate(sensorId)}
          onDisarm={() => disarmMutation.mutate(sensorId)}
        />
      </div>
    </div>
  )
}
