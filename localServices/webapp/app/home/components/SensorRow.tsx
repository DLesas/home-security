'use client'

import { motion } from 'framer-motion'
import { Divider } from '@nextui-org/divider'
import { Button } from '@nextui-org/button'
import { StatusPill } from './StatusPill'
import { ArmDisarmButtons } from '../../../components/ArmDisarmButtons'
import { LogStatus } from '../../types'
import { useSensorUpdatesQuery } from '../../../hooks/queries/useSensorUpdatesQuery'
import { useArmSensorMutation, useDisarmSensorMutation } from '../../../hooks/mutations/useSensorMutations'
import { MdAccessTime } from 'react-icons/md'
import { IoChevronForward } from 'react-icons/io5'

interface SensorRowProps {
  sensorName: string
  sensorExternalID: string
  sensorArmed: boolean
  sensorStatus: LogStatus
  index: number
  onSensorClick: () => void
}

export function SensorRow({
  sensorName,
  sensorExternalID,
  sensorArmed,
  sensorStatus,
  index,
  onSensorClick,
}: SensorRowProps) {
  const armMutation = useArmSensorMutation()
  const disarmMutation = useDisarmSensorMutation()

  // Fetch last open update for this sensor (limit 1, filter by state=open)
  const { data } = useSensorUpdatesQuery(sensorExternalID, 1, 0, 'open', !!sensorExternalID)

  const formatLastOpen = () => {
    if (!data?.updates || data.updates.length === 0) return null

    const lastOpenUpdate = data.updates[0]
    if (!lastOpenUpdate?.dateTime) return null

    const date = new Date(lastOpenUpdate.dateTime)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const lastOpenText = formatLastOpen()

  // Determine border color based on status
  const getBorderColor = () => {
    if (sensorArmed && sensorStatus === 'open') return 'border-l-danger'
    if (sensorArmed) return 'border-l-warning'
    return 'border-l-success'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`border bg-default-100 border-default-200 rounded-lg overflow-hidden ${getBorderColor()} border-l-4`}
    >
      {/* Header Section */}
      <div className="p-4 pb-3">
        <div
          onClick={onSensorClick}
          className="flex items-start justify-between mb-3 cursor-pointer active:bg-default-200/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-1">
            <span className="font-medium leading-none">{sensorName}</span>
            <Button
              isIconOnly
              variant={'undefined' as any}
              size="sm"
              aria-label="View Sensor Details"
              onClick={onSensorClick}
            >
              <IoChevronForward/>
            </Button>
          </div>

          <div className="flex gap-2 flex-wrap justify-end">
            {sensorArmed && <StatusPill type="armed">Armed</StatusPill>}

            {sensorStatus === 'open' ? (
              <StatusPill type="open">Open</StatusPill>
            ) : sensorStatus === 'closed' ? (
              <StatusPill type="closed">Closed</StatusPill>
            ) : (
              <StatusPill type="unknown">Unknown</StatusPill>
            )}
          </div>
        </div>

        {/* Last Open Time with Icon */}
        {lastOpenText && (
          <div className="flex items-center gap-1.5 text-xs text-default-500 mb-3">
            <MdAccessTime className="text-sm" />
            <span>Last opened {lastOpenText}</span>
          </div>
        )}
      </div>

      <Divider />

      {/* Actions Section */}
      <div className="p-4 pt-3">
        <ArmDisarmButtons
          isArmed={sensorArmed}
          currentState={sensorStatus}
          entityName={sensorName}
          armLoading={armMutation.isPending}
          disarmLoading={disarmMutation.isPending}
          onArm={() => armMutation.mutate(sensorExternalID)}
          onDisarm={() => disarmMutation.mutate(sensorExternalID)}
          className="gap-2"
          buttonClassName="text-sm h-9"
        />
      </div>
    </motion.div>
  )
}
