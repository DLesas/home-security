'use client'

import { Card, CardHeader, CardBody } from '@nextui-org/card'
import { useSensorUpdatesQuery } from '../../../hooks/queries/useSensorUpdatesQuery'

interface RecentActivityCardProps {
  sensorId: string
}

export function RecentActivityCard({ sensorId }: RecentActivityCardProps) {
  const { data: recentActivityData, isLoading } = useSensorUpdatesQuery(
    sensorId,
    10,
    0,
    undefined,
    !!sensorId
  )

  const recentActivity = recentActivityData?.updates || []

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime)
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStateColor = (state: string) => {
    switch (state) {
      case 'open':
        return 'text-danger-600'
      case 'closed':
        return 'text-success-600'
      default:
        return 'text-warning-600'
    }
  }

  if (isLoading) {
    return (
      <Card className="mb-4 shadow-md sm:mb-6">
        <CardHeader className="pb-2">
          <h2 className="text-base font-volkorn font-semibold">Recent Activity</h2>
        </CardHeader>
        <CardBody className="pt-2">
          <p className="text-sm text-default-500">Loading...</p>
        </CardBody>
      </Card>
    )
  }

  if (!recentActivity || recentActivity.length === 0) {
    return (
      <Card className="mb-4 shadow-md sm:mb-6">
        <CardHeader className="pb-2">
          <h2 className="text-base font-volkorn font-semibold">Recent Activity</h2>
        </CardHeader>
        <CardBody className="pt-2">
          <p className="text-sm text-default-500">No recent activity</p>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card className="mb-4 shadow-md sm:mb-6">
      <CardHeader className="pb-2">
        <h2 className="text-base font-volkorn font-semibold">Recent Activity</h2>
      </CardHeader>
      <CardBody className="pt-2">
        <div className="max-h-96 overflow-y-auto">
          <div className="space-y-2">
            {recentActivity.map((update, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-2 px-3 bg-default-100 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className={`font-medium capitalize ${getStateColor(update.state)}`}>
                    {update.state}
                  </span>
                </div>
                <span className="text-xs text-default-500">
                  {update.dateTime && formatDateTime(update.dateTime)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
