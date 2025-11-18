'use client'

import { Button } from '@nextui-org/button'
import { cn } from '@/lib/utils'

interface ArmDisarmButtonsProps {
  /**
   * Current armed state - true if armed, false if disarmed
   */
  isArmed: boolean

  /**
   * Callback when arm button is pressed
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

  return (
    <div className={cn('flex justify-around', className)}>
      <Button
        variant={isArmed ? 'solid' : 'bordered'}
        color="danger"
        className={cn('', buttonClassName)}
        isLoading={armLoading}
        isDisabled={isDisabled}
        onPress={onArm}
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
  )
}
