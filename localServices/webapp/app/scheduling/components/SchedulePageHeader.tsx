'use client'

interface SchedulePageHeaderProps {
  activeCount: number
  inactiveCount: number
}

export function SchedulePageHeader({
  activeCount,
  inactiveCount,
}: SchedulePageHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Page Title */}
      <h1 className="text-3xl md:text-4xl font-volkorn font-semibold">
        Schedules
      </h1>

      {/* Schedule Summary */}
      <p className="text-base text-gray-600">
        {activeCount} active {activeCount === 1 ? 'schedule' : 'schedules'}
        {inactiveCount > 0 && ` • ${inactiveCount} inactive`}
      </p>
    </div>
  )
}
