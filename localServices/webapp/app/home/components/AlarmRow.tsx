'use client'

import { motion } from 'framer-motion'
import { Button } from '@nextui-org/button'
import { StatusPill } from './StatusPill'
import { type Alarm } from '../../socketData'
import { IoChevronForward } from 'react-icons/io5'

interface AlarmRowProps {
  alarms: Alarm[]
  index: number
  onAlarmClick: (alarmId: string) => void
}

export function AlarmRow({
  alarms,
  index,
  onAlarmClick,
}: AlarmRowProps) {
  if (alarms.length === 0) return null

  // Determine border color based on playing status - red if any alarm is playing
  const getBorderColor = () => {
    if (alarms.some(alarm => alarm.playing)) return 'border-l-danger'
    if (alarms.some(alarm => alarm.state === 'unknown')) return 'border-l-warning'
    return 'border-l-success'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`border bg-default-100 border-default-200 rounded-lg overflow-hidden ${getBorderColor()} border-l-4`}
    >
      <div className="p-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${alarms.length}, minmax(0, 1fr))` }}>
          {alarms.map((alarm) => (
            <div
              key={alarm.externalID}
              onClick={() => onAlarmClick(alarm.externalID)}
              className="flex flex-col gap-2 cursor-pointer active:bg-default-200/50 p-2 rounded-lg transition-colors border border-default-200"
            >
              <div className="flex items-center gap-1 justify-between">
                <span className="font-medium leading-none text-sm">{alarm.name}</span>
                <Button
                  isIconOnly
                  variant={'undefined' as any}
                  size="sm"
                  aria-label="View Alarm Details"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAlarmClick(alarm.externalID)
                  }}
                >
                  <IoChevronForward size={14} />
                </Button>
              </div>

              <div className="flex gap-1 flex-wrap">
                {alarm.playing && <StatusPill type="armed">Playing</StatusPill>}

                {alarm.state === 'connected' ? (
                  <StatusPill type="connected">Connected</StatusPill>
                ) : alarm.state === 'disconnected' ? (
                  <StatusPill type="disconnected">Disconnected</StatusPill>
                ) : (
                  <StatusPill type="unknown">Unknown</StatusPill>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
