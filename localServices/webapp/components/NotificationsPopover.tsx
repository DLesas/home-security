'use client'

import React from 'react'
import { Badge } from '@nextui-org/badge'
import { Button } from '@nextui-org/button'
import { Chip } from '@nextui-org/chip'
import { MdNotifications } from 'react-icons/md'
import { Popover, PopoverTrigger, PopoverContent } from '@nextui-org/popover'
import { useSocketData } from '../app/socketData'
import { EventType } from '../app/types'
import ms from 'ms'

const getEventColor = (type: EventType): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
  switch (type) {
    case 'critical':
      return 'danger'
    case 'warning':
      return 'warning'
    case 'info':
      return 'primary'
    case 'debug':
      return 'default'
    default:
      return 'default'
  }
}

const formatTimestamp = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  return ms(diff, { long: true }) + ' ago'
}

function LiveTimestamp({ timestamp }: { timestamp: number }) {
  const [formattedTime, setFormattedTime] = React.useState(() => formatTimestamp(timestamp))

  React.useEffect(() => {
    // Update immediately
    setFormattedTime(formatTimestamp(timestamp))

    // Then update every second
    const interval = setInterval(() => {
      setFormattedTime(formatTimestamp(timestamp))
    }, 1000)

    return () => clearInterval(interval)
  }, [timestamp])

  return <>{formattedTime}</>
}

export default function NotificationsPopover() {
  const { notifications, dismissNotification, clearAllNotifications } = useSocketData()
  const [filterTypes, setFilterTypes] = React.useState<Set<EventType>>(
    new Set(['debug', 'info', 'warning', 'critical'])
  )

  const filteredNotifications = notifications.filter((notification) =>
    filterTypes.has(notification.data.type)
  )

  // Count notifications by type
  const notificationCounts = React.useMemo(() => {
    const counts: Record<EventType, number> = {
      debug: 0,
      info: 0,
      warning: 0,
      critical: 0
    }
    notifications.forEach((notification) => {
      counts[notification.data.type]++
    })
    return counts
  }, [notifications])

  const toggleFilter = (type: EventType) => {
    setFilterTypes((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(type)) {
        newSet.delete(type)
      } else {
        newSet.add(type)
      }
      return newSet
    })
  }

  return (
    <Badge
      content={notifications.length > 0 ? notifications.length : undefined}
      variant='flat'
      shape="circle"
      color="danger"
      size="sm"
    >
      <Popover placement="bottom-end" showArrow offset={10}>
        <PopoverTrigger>
          <Button
            isIconOnly
            radius="full"
            variant="light"
            aria-label="Notifications"
          >
            <MdNotifications size={20} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0">
          <div className="px-4 py-3 border-b border-default-200 dark:border-default-100">
            <p className="text-sm font-semibold text-center mb-2">Notifications</p>
            <div className="flex gap-2 justify-center">
              {(['critical', 'warning', 'info', 'debug'] as EventType[]).map((type) => (
                <Chip
                  key={type}
                  size="sm"
                  variant={filterTypes.has(type) ? 'flat' : 'light'}
                  color={getEventColor(type)}
                  className="cursor-pointer capitalize"
                  onClick={() => toggleFilter(type)}
                >
                  {type} ({notificationCounts[type]})
                </Chip>
              ))}
            </div>
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            {filteredNotifications.length > 0 ? (
              <div className="divide-y divide-default-200 dark:divide-default-100">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.timestamp}
                    className="px-4 py-3 hover:bg-default-100 dark:hover:bg-default-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Chip size="sm" color={getEventColor(notification.data.type)} variant="flat">
                            {notification.data.type}
                          </Chip>
                          <p className="text-xs text-default-500">
                            <LiveTimestamp timestamp={notification.timestamp} />
                          </p>
                        </div>
                        <p className="text-sm font-medium text-default-400 mb-1">
                          {notification.data.title}
                        </p>
                        <p className="text-sm text-default-300">
                          {notification.data.message}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={() => dismissNotification(notification.timestamp)}
                        className="shrink-0"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-default-500">
                  {notifications.length > 0
                    ? 'No notifications match the selected filters'
                    : 'No notifications'}
                </p>
              </div>
            )}
          </div>
          {notifications.length > 0 && (
            <div className="sticky bottom-0 px-4 py-2">
              <Button
                size="sm"
                color="danger"
                variant="bordered"
                className="w-full bg-inherit"
                onPress={clearAllNotifications}
              >
                Clear All
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </Badge>
  )
}
