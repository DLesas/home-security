'use client'

import { Button } from '@nextui-org/button'
import { useDisclosure } from '@nextui-org/modal'
import { cn } from '@/lib/utils'
import { ArmWarningModal } from '../app/home/components/ArmWarningModal'

interface ArmDisarmButtonsProps {
  /**
   * Current armed state - true if armed, false if disarmed
   */
  isArmed: boolean

  /**
   * Current sensor/building state
   */
  currentState?: 'open' | 'closed' | 'unknown'

  /**
   * Name of the entity (sensor or building) for warning messages
   */
  entityName?: string

  /**
   * Callback when arm button is pressed (will be called after confirmation if needed)
   */
  onArm: () => void

  /**
   * Callback when disarm button is pressed
   */
  onDisarm: () => void

  /**
   * Arm button loading state
   */
  armLoading?: boolean

  /**
   * Disarm button loading state
   */
  disarmLoading?: boolean

  /**
   * Disabled state for both buttons
   */
  isDisabled?: boolean

  /**
   * Additional CSS classes for the container (will override defaults using cn)
   */
  className?: string

  /**
   * Additional CSS classes for individual buttons
   */
  buttonClassName?: string

  /**
   * Custom arm label (defaults to "Arm"/"Armed")
   */
  armLabel?: string

  /**
   * Custom disarm label (defaults to "Disarm"/"Disarmed")
   */
  disarmLabel?: string
}

export function ArmDisarmButtons({
  isArmed,
  currentState,
  entityName = 'sensor',
  onArm,
  onDisarm,
  armLoading = false,
  disarmLoading = false,
  isDisabled = false,
  className,
  buttonClassName,
  armLabel,
  disarmLabel,
}: ArmDisarmButtonsProps) {
  const defaultArmLabel = isArmed ? 'Armed' : 'Arm'
  const defaultDisarmLabel = !isArmed ? 'Disarmed' : 'Disarm'
  const { isOpen: isWarningOpen, onOpen: onWarningOpen, onOpenChange: onWarningOpenChange } = useDisclosure()

  const handleArmClick = () => {
    // Check if we need to show a warning
    if (currentState && (currentState === 'open' || currentState === 'unknown')) {
      onWarningOpen()
    } else {
      onArm()
    }
  }

  const handleConfirmArm = () => {
    onArm()
  }

  const getWarningTitle = () => {
    if (!currentState) return ''
    return `${entityName} is currently in an ${currentState} state`
  }

  const getWarningMessage = () => {
    if (!currentState) return ''

    if (currentState === 'open') {
      return `The ${entityName} is currently open. Arming will cause the alarm to go off. Are you sure you wish to continue?`
    } else {
      return `The ${entityName} is currently in an unknown state. If you arm and it turns out to be open (once it starts responding again) it will trigger the alarm. Are you sure you wish to continue?`
    }
  }

  return (
    <>
      <div className={cn('flex justify-around', className)}>
        <Button
          variant={isArmed ? 'solid' : 'bordered'}
          color="danger"
          className={cn('', buttonClassName)}
          isLoading={armLoading}
          isDisabled={isDisabled}
          onPress={handleArmClick}
        >
          {armLabel || defaultArmLabel}
        </Button>
        <Button
          variant={!isArmed ? 'solid' : 'bordered'}
          color="success"
          className={cn('', buttonClassName)}
          isLoading={disarmLoading}
          isDisabled={isDisabled}
          onPress={onDisarm}
        >
          {disarmLabel || defaultDisarmLabel}
        </Button>
      </div>

      {currentState && (currentState === 'open' || currentState === 'unknown') && (
        <ArmWarningModal
          isOpen={isWarningOpen}
          onOpenChange={onWarningOpenChange}
          title={getWarningTitle()}
          message={getWarningMessage()}
          onConfirm={handleConfirmArm}
          onCancel={() => {}}
          confirmText={`Arm ${entityName}`}
        />
      )}
    </>
  )
}
