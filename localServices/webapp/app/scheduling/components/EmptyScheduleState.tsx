'use client'

import { MdSchedule } from 'react-icons/md'

export function EmptyScheduleState() {
  return (
    <div className="text-center py-12 text-gray-500">
      <MdSchedule className="mx-auto mb-4" size={48} />
      <p className="text-lg">No schedules yet</p>
      <p className="text-sm mt-2">
        Tap the + button to create one
      </p>
    </div>
  )
}
