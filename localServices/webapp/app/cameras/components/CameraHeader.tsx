'use client'

import { Card, CardHeader } from '@nextui-org/card'
import { Button } from '@nextui-org/button'
import { MdSettings } from 'react-icons/md'

interface CameraHeaderProps {
  cameraName: string
  buildingName: string
  isStreaming: boolean
  motionDetectionEnabled: boolean
  lastUpdated?: string | Date
  onSettingsClick: () => void
}

export function CameraHeader({
  cameraName,
  buildingName,
  isStreaming,
  motionDetectionEnabled,
  lastUpdated,
  onSettingsClick,
}: CameraHeaderProps) {
  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Never'

    const date = new Date(lastUpdated)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Card className="mb-4 shadow-md">
      <CardHeader className="pb-2">
        <div className="w-full flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-2xl font-volkorn font-bold mb-2">
              {cameraName} <span className="text-default-500 text-lg">({buildingName})</span>
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                isStreaming
                  ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                  : 'bg-default-200 text-default-500'
              }`}>
                {isStreaming ? 'Streaming' : 'Offline'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                motionDetectionEnabled
                  ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                  : 'bg-default-200 text-default-500'
              }`}>
                Motion {motionDetectionEnabled ? 'On' : 'Off'}
              </span>
              <span className="text-xs text-default-500">
                Last updated {formatLastUpdated()}
              </span>
            </div>
          </div>
          <Button
            isIconOnly
            variant="light"
            size="sm"
            onPress={onSettingsClick}
            className="text-default-500"
          >
            <MdSettings className="text-xl" />
          </Button>
        </div>
      </CardHeader>
    </Card>
  )
}
