'use client'

import { useDisclosure } from '@nextui-org/modal'
import { useSocketData, type schedule as scheduleType } from '../socketData'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ScheduleEditor } from './scheduleEditor'
import { ScheduleCard } from './components/ScheduleCard'
import { SchedulePageHeader } from './components/SchedulePageHeader'
import { FloatingActionButton } from './components/FloatingActionButton'
import { EmptyScheduleState } from './components/EmptyScheduleState'

export default function SchedulingPage() {
  const { schedules } = useSocketData()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [selectedSchedule, setSelectedSchedule] = useState<scheduleType | null>(null)

  // Calculate schedule counts
  const activeSchedules = schedules.filter(s => s.type === 'recurring' ? s.active : true)
  const inactiveSchedules = schedules.filter(s => s.type === 'recurring' ? !s.active : false)

  const handleOpenNew = () => {
    setSelectedSchedule(null)
    onOpen()
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 md:py-12">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-12"
      >
        <SchedulePageHeader
          activeCount={activeSchedules.length}
          inactiveCount={inactiveSchedules.length}
        />
      </motion.div>

      {/* Schedule Cards - Responsive Grid */}
      <div className="space-y-4">
        {schedules.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <EmptyScheduleState />
          </motion.div>
        ) : (
          schedules.map((schedule, index) => (
            <motion.div
              key={schedule.id || `${index}_${schedule.name}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <ScheduleCard
                schedule={schedule}
                setSelectedSchedule={setSelectedSchedule}
                onOpen={onOpen}
              />
            </motion.div>
          ))
        )}
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton onPress={handleOpenNew} label="New Schedule" />

      {/* Schedule Editor Modal */}
      <ScheduleEditor
        schedule={selectedSchedule}
        isOpen={isOpen}
        onClose={onClose}
      />
    </div>
  )
}
