'use client'

import { Card, CardHeader, CardBody } from '@nextui-org/card'
import { Button } from '@nextui-org/button'
import { Chip } from '@nextui-org/chip'
import { Divider } from '@nextui-org/divider'
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from '@nextui-org/dropdown'
import { SlOptionsVertical } from 'react-icons/sl'
import { MdRepeat, MdEventNote } from 'react-icons/md'
import { type schedule as scheduleType } from '../../socketData'
import { useSocket } from '../../socketInitializer'

interface ScheduleCardProps {
  schedule: scheduleType
  setSelectedSchedule: (schedule: scheduleType | null) => void
  onOpen: () => void
}

export function ScheduleCard({
  schedule,
  setSelectedSchedule,
  onOpen,
}: ScheduleCardProps) {
  const { url } = useSocket()
  const isRecurring = schedule.type === 'recurring'
  const isActive = isRecurring ? schedule.active : true

  const handleDelete = async () => {
    try {
      const response = await fetch(`${url}/api/v1/schedules/${schedule.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete schedule')
      }
    } catch (error) {
      console.error('Error deleting schedule:', error)
      alert(`Failed to delete schedule: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Format display info
  const getRecurrenceDisplay = () => {
    if (!isRecurring) return 'One-time'
    if (schedule.recurrence === 'Daily') return 'Daily'
    if (schedule.days && schedule.days.length > 0) {
      return schedule.days.map(d => d.slice(0, 3)).join(', ')
    }
    return 'Weekly'
  }

  const formatDateTime = (dateInput: Date | string) => {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput)
    return {
      date: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    }
  }

  return (
    <Card
      className="w-full shadow-md hover:shadow-lg transition-shadow duration-200"
      isPressable
      onPress={() => {
        setSelectedSchedule(schedule)
        onOpen()
      }}
    >
      <CardHeader className="pb-2 flex justify-between items-center">
          <h2 className="text-xl font-volkorn font-semibold">{schedule.name}</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              {isRecurring ? <MdRepeat size={16} /> : <MdEventNote size={16} />}
              <span>{getRecurrenceDisplay()}</span>
            </div>
            <span>•</span>
            <span>
              {schedule.sensorIDs.length} {schedule.sensorIDs.length === 1 ? 'sensor' : 'sensors'}
            </span>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {!isActive && (
              <Chip size="sm" variant="flat" color="default">
                Inactive
              </Chip>
            )}
            <Dropdown>
              <DropdownTrigger>
                <Button isIconOnly variant="light" size="sm">
                  <SlOptionsVertical />
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Schedule Actions">
                <DropdownItem
                  key="edit"
                  onPress={() => {
                    setSelectedSchedule(schedule)
                    onOpen()
                  }}
                >
                  Edit
                </DropdownItem>
                <DropdownItem
                  key="delete"
                  className="text-danger"
                  color="danger"
                  onPress={handleDelete}
                >
                  Delete
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>
      </CardHeader>

      <Divider />

      <CardBody className="pt-4 space-y-4">
        {/* Arm/Disarm Times */}
        <div className="flex flex-row justify-around items-center gap-4">
          {/* Arm Time/DateTime */}
          <div className="flex flex-row items-center gap-2">
            <Chip color="success" size="sm" variant="flat">ARM</Chip>
            <div>
              {isRecurring ? (
                <>
                  <p className="text-sm font-medium">{schedule.armTime}</p>
                  {schedule.armDayOffset > 0 && (
                    <p className="text-xs text-gray-500">+{schedule.armDayOffset} day</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">{formatDateTime(schedule.armDateTime).time}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(schedule.armDateTime).date}</p>
                </>
              )}
            </div>
          </div>

          {/* Disarm Time/DateTime */}
          <div className="flex flex-row items-center gap-2">
            <Chip color="warning" size="sm" variant="flat">DISARM</Chip>
            <div>
              {isRecurring ? (
                <>
                  <p className="text-sm font-medium">{schedule.disarmTime}</p>
                  {schedule.disarmDayOffset > 0 && (
                    <p className="text-xs text-gray-500">+{schedule.disarmDayOffset} day</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">{formatDateTime(schedule.disarmDateTime).time}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(schedule.disarmDateTime).date}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
