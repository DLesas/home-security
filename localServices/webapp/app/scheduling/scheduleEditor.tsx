import { useSocketData, type schedule as scheduleType } from '../socketData'
import { useSocket } from '../socketInitializer'
import { Input } from '@nextui-org/input'
import { Select, SelectItem } from '@nextui-org/select'
import { TimeInput } from '@nextui-org/date-input'
import { DatePicker } from '@nextui-org/date-picker'
import { Time, ZonedDateTime, parseAbsoluteToLocal } from '@internationalized/date'
import { getLocalTimeZone, now } from '@internationalized/date'
import { useEffect, useState } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@nextui-org/modal'
import { CheckboxGroup, Checkbox } from '@nextui-org/checkbox'
import { Button } from '@nextui-org/button'
import { Card, CardBody } from '@nextui-org/card'
import { Chip } from '@nextui-org/chip'

// Unified schedule data interface
interface RecurringScheduleData {
  type: 'recurring'
  name: string
  sensorIds: string[]
  armTime: string // "HH:MM"
  armDayOffset: number
  disarmTime: string // "HH:MM"
  disarmDayOffset: number
  recurrence: 'Daily' | 'Weekly'
  days?: string[]
  active: boolean
}

interface OneTimeScheduleData {
  type: 'oneTime'
  name: string
  sensorIds: string[]
  armDateTime: string // ISO datetime
  disarmDateTime: string // ISO datetime
}

type ScheduleData = RecurringScheduleData | OneTimeScheduleData

export function ScheduleEditor({
  schedule,
  isOpen,
  onClose,
}: {
  schedule: scheduleType | null
  isOpen: boolean
  onClose: () => void
}) {
  const { sensors } = useSocketData()
  const { url } = useSocket()

  // Schedule type selection
  const [scheduleType, setScheduleType] = useState<'recurring' | 'oneTime'>('recurring')

  // Unified schedule state
  const [scheduleData, setScheduleData] = useState<ScheduleData>({
    type: 'recurring',
    name: '',
    sensorIds: [],
    armTime: '21:00',
    armDayOffset: 0,
    disarmTime: '07:00',
    disarmDayOffset: 1,
    recurrence: 'Daily',
    days: [],
    active: true,
  })

  const [loading, setLoading] = useState(false)

  // Initialize from existing schedule if editing
  useEffect(() => {
    if (schedule) {
      setScheduleType(schedule.type)

      if (schedule.type === 'recurring') {
        setScheduleData({
          type: 'recurring',
          name: schedule.name,
          sensorIds: schedule.sensorIDs,
          armTime: schedule.armTime,
          armDayOffset: schedule.armDayOffset,
          disarmTime: schedule.disarmTime,
          disarmDayOffset: schedule.disarmDayOffset,
          recurrence: schedule.recurrence,
          days: schedule.days || [],
          active: schedule.active,
        })
      } else {
        // armDateTime and disarmDateTime are already Date objects, convert to ISO string
        const armDate = schedule.armDateTime instanceof Date
          ? schedule.armDateTime
          : new Date(schedule.armDateTime)
        const disarmDate = schedule.disarmDateTime instanceof Date
          ? schedule.disarmDateTime
          : new Date(schedule.disarmDateTime)

        setScheduleData({
          type: 'oneTime',
          name: schedule.name,
          sensorIds: schedule.sensorIDs,
          armDateTime: armDate.toISOString(),
          disarmDateTime: disarmDate.toISOString(),
        })
      }
    } else {
      // Reset to defaults when creating new schedule
      if (scheduleType === 'recurring') {
        setScheduleData({
          type: 'recurring',
          name: '',
          sensorIds: [],
          armTime: '21:00',
          armDayOffset: 0,
          disarmTime: '07:00',
          disarmDayOffset: 1,
          recurrence: 'Daily',
          days: [],
          active: true,
        })
      } else {
        setScheduleData({
          type: 'oneTime',
          name: '',
          sensorIds: [],
          armDateTime: now(getLocalTimeZone()).add({ hours: 1 }).toDate().toISOString(),
          disarmDateTime: now(getLocalTimeZone()).add({ hours: 3 }).toDate().toISOString(),
        })
      }
    }
  }, [schedule, scheduleType])

  // Handle schedule type change (only for new schedules)
  const handleScheduleTypeChange = (newType: 'recurring' | 'oneTime') => {
    setScheduleType(newType)

    // Preserve name and sensorIds, reset other fields
    const currentName = scheduleData.name
    const currentSensorIds = scheduleData.sensorIds

    if (newType === 'recurring') {
      setScheduleData({
        type: 'recurring',
        name: currentName,
        sensorIds: currentSensorIds,
        armTime: '21:00',
        armDayOffset: 0,
        disarmTime: '07:00',
        disarmDayOffset: 1,
        recurrence: 'Daily',
        days: [],
        active: true,
      })
    } else {
      setScheduleData({
        type: 'oneTime',
        name: currentName,
        sensorIds: currentSensorIds,
        armDateTime: now(getLocalTimeZone()).add({ hours: 1 }).toDate().toISOString(),
        disarmDateTime: now(getLocalTimeZone()).add({ hours: 3 }).toDate().toISOString(),
      })
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const endpoint = schedule ? `/schedules/${schedule.id}` : '/schedules/new'
      const method = schedule ? 'PUT' : 'POST'

      const response = await fetch(`${url}/api/v1${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to save schedule')
      }

      onClose()
    } catch (error) {
      console.error('Error saving schedule:', error)
      alert(`Failed to save schedule: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!schedule) return
    setLoading(true)
    try {
      const response = await fetch(`${url}/api/v1/schedules/${schedule.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete schedule')
      onClose()
    } catch (error) {
      console.error('Error deleting schedule:', error)
      alert(`Failed to delete schedule: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const renderRecurringScheduleForm = (data: RecurringScheduleData) => {
    const armHour = parseInt(data.armTime.split(':')[0])
    const armMin = parseInt(data.armTime.split(':')[1])
    const disarmHour = parseInt(data.disarmTime.split(':')[0])
    const disarmMin = parseInt(data.disarmTime.split(':')[1])

    return (
      <div className="flex flex-col gap-6">
        <Input
          label="Schedule name"
          isRequired
          value={data.name}
          onChange={(e) =>
            setScheduleData({ ...data, name: e.target.value })
          }
          placeholder="Evening Security Schedule"
          classNames={{
            label: 'font-medium',
          }}
        />

        <Select
          label="Recurrence"
          isRequired
          selectedKeys={[data.recurrence]}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as 'Daily' | 'Weekly'
            setScheduleData({ ...data, recurrence: value })
          }}
          classNames={{
            label: 'font-medium',
          }}
        >
          <SelectItem key="Daily">Daily</SelectItem>
          <SelectItem key="Weekly">Weekly</SelectItem>
        </Select>

        {data.recurrence === 'Weekly' && (
          <div>
            <p className="mb-3 text-sm font-medium">Select days</p>
            <CheckboxGroup
              value={data.days}
              onValueChange={(value) =>
                setScheduleData({ ...data, days: value })
              }
              orientation="horizontal"
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Checkbox value="Monday" size="sm">Mon</Checkbox>
                <Checkbox value="Tuesday" size="sm">Tue</Checkbox>
                <Checkbox value="Wednesday" size="sm">Wed</Checkbox>
                <Checkbox value="Thursday" size="sm">Thu</Checkbox>
                <Checkbox value="Friday" size="sm">Fri</Checkbox>
                <Checkbox value="Saturday" size="sm">Sat</Checkbox>
                <Checkbox value="Sunday" size="sm">Sun</Checkbox>
              </div>
            </CheckboxGroup>
          </div>
        )}

        <Card className="shadow-sm">
          <CardBody className="gap-4 p-4">
            <div className="flex items-center gap-2">
              <Chip color="success" size="sm" variant="flat">ARM</Chip>
              <span className="text-base font-medium">Arm Configuration</span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <TimeInput
                label="Arm Time"
                isRequired
                hourCycle={24}
                value={new Time(armHour, armMin)}
                onChange={(value) => {
                  setScheduleData({
                    ...data,
                    armTime: `${value.hour.toString().padStart(2, '0')}:${value.minute.toString().padStart(2, '0')}`,
                  })
                }}
                granularity="minute"
                hideTimeZone
                classNames={{
                  label: 'font-medium',
                }}
              />

              <Select
                label="Day Offset"
                isRequired
                selectedKeys={[data.armDayOffset.toString()]}
                onSelectionChange={(keys) => {
                  const value = parseInt(Array.from(keys)[0] as string)
                  setScheduleData({ ...data, armDayOffset: value })
                }}
                classNames={{
                  label: 'font-medium',
                }}
              >
                <SelectItem key="0">Same day</SelectItem>
                <SelectItem key="1">Next day</SelectItem>
              </Select>
            </div>
            <p className="text-sm text-gray-600">
              When to arm the sensors (e.g., evening before bedtime)
            </p>
          </CardBody>
        </Card>

        <Card className="shadow-sm">
          <CardBody className="gap-4 p-4">
            <div className="flex items-center gap-2">
              <Chip color="warning" size="sm" variant="flat">DISARM</Chip>
              <span className="text-base font-medium">Disarm Configuration</span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <TimeInput
                label="Disarm Time"
                isRequired
                hourCycle={24}
                value={new Time(disarmHour, disarmMin)}
                onChange={(value) => {
                  setScheduleData({
                    ...data,
                    disarmTime: `${value.hour.toString().padStart(2, '0')}:${value.minute.toString().padStart(2, '0')}`,
                  })
                }}
                granularity="minute"
                hideTimeZone
                classNames={{
                  label: 'font-medium',
                }}
              />

              <Select
                label="Day Offset"
                isRequired
                selectedKeys={[data.disarmDayOffset.toString()]}
                onSelectionChange={(keys) => {
                  const value = parseInt(Array.from(keys)[0] as string)
                  setScheduleData({ ...data, disarmDayOffset: value })
                }}
                classNames={{
                  label: 'font-medium',
                }}
              >
                <SelectItem key="0">Same day</SelectItem>
                <SelectItem key="1">Next day</SelectItem>
              </Select>
            </div>
            <p className="text-sm text-gray-600">
              When to disarm the sensors (e.g., morning after waking up)
            </p>
          </CardBody>
        </Card>
      </div>
    )
  }

  const renderOneTimeScheduleForm = (data: OneTimeScheduleData) => {
    // Parse ISO datetime to separate date and time
    const parseISODateTime = (isoString: string) => {
      const date = new Date(isoString)
      return {
        date: parseAbsoluteToLocal(isoString),
        time: new Time(date.getHours(), date.getMinutes()),
      }
    }

    const armDateTime = parseISODateTime(data.armDateTime)
    const disarmDateTime = parseISODateTime(data.disarmDateTime)

    // Helper to combine date and time into ISO string
    const combineDateTime = (dateValue: ZonedDateTime, timeValue: Time): string => {
      const combined = dateValue.set({
        hour: timeValue.hour,
        minute: timeValue.minute,
      })
      return combined.toDate().toISOString()
    }

    return (
      <div className="flex flex-col gap-6">
        <Input
          label="Schedule name"
          isRequired
          value={data.name}
          onChange={(e) =>
            setScheduleData({ ...data, name: e.target.value })
          }
          placeholder="Vacation Security"
          classNames={{
            label: 'font-medium',
          }}
        />

        <Card className="shadow-sm">
          <CardBody className="gap-4 p-4">
            <div className="flex items-center gap-2">
              <Chip color="success" size="sm" variant="flat">ARM</Chip>
              <span className="text-base font-medium">Arm Date & Time</span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <DatePicker
                label="Arm Date"
                isRequired
                value={armDateTime.date}
                onChange={(value: ZonedDateTime) => {
                  if (value) {
                    setScheduleData({
                      ...data,
                      armDateTime: combineDateTime(value, armDateTime.time),
                    })
                  }
                }}
                granularity="day"
                classNames={{
                  label: 'font-medium',
                }}
              />

              <TimeInput
                label="Arm Time"
                isRequired
                hourCycle={24}
                value={armDateTime.time}
                onChange={(value: Time) => {
                  setScheduleData({
                    ...data,
                    armDateTime: combineDateTime(armDateTime.date, value),
                  })
                }}
                granularity="minute"
                hideTimeZone
                classNames={{
                  label: 'font-medium',
                }}
              />
            </div>
            <p className="text-sm text-gray-600">
              When to arm the sensors
            </p>
          </CardBody>
        </Card>

        <Card className="shadow-sm">
          <CardBody className="gap-4 p-4">
            <div className="flex items-center gap-2">
              <Chip color="warning" size="sm" variant="flat">DISARM</Chip>
              <span className="text-base font-medium">Disarm Date & Time</span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <DatePicker
                label="Disarm Date"
                isRequired
                value={disarmDateTime.date}
                onChange={(value: ZonedDateTime) => {
                  if (value) {
                    setScheduleData({
                      ...data,
                      disarmDateTime: combineDateTime(value, disarmDateTime.time),
                    })
                  }
                }}
                granularity="day"
                classNames={{
                  label: 'font-medium',
                }}
              />

              <TimeInput
                label="Disarm Time"
                isRequired
                hourCycle={24}
                value={disarmDateTime.time}
                onChange={(value: Time) => {
                  setScheduleData({
                    ...data,
                    disarmDateTime: combineDateTime(disarmDateTime.date, value),
                  })
                }}
                granularity="minute"
                hideTimeZone
                classNames={{
                  label: 'font-medium',
                }}
              />
            </div>
            <p className="text-sm text-gray-600">
              When to disarm the sensors
            </p>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: 'max-h-[90vh] mx-4',
        body: 'overflow-y-auto px-6 py-6',
        header: 'border-b border-divider',
        footer: 'border-t border-divider',
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-2 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-volkorn font-semibold">
                  {schedule ? 'Edit Schedule' : 'New Schedule'}
                </h2>
                <Chip
                  color={scheduleType === 'recurring' ? 'primary' : 'secondary'}
                  size="sm"
                  variant="flat"
                >
                  {scheduleType === 'recurring' ? 'Recurring' : 'One-Time'}
                </Chip>
              </div>
            </ModalHeader>

            <ModalBody>
              <div className="flex flex-col gap-6">
                {/* Schedule Type Selection for new schedules */}
                {!schedule && (
                  <div>
                    <Select
                      label="Schedule Type"
                      isRequired
                      selectedKeys={[scheduleType]}
                      onSelectionChange={(keys) => {
                        const value = Array.from(keys)[0] as 'recurring' | 'oneTime'
                        handleScheduleTypeChange(value)
                      }}
                      classNames={{
                        label: 'font-medium',
                      }}
                    >
                      <SelectItem key="recurring">Recurring Schedule</SelectItem>
                      <SelectItem key="oneTime">One-Time Schedule</SelectItem>
                    </Select>
                  </div>
                )}

                {/* Sensor Selection */}
                <Card className="shadow-sm">
                  <CardBody className="gap-3 p-4">
                    <div>
                      <p className="mb-2 text-base font-medium">
                        Select Sensors
                      </p>
                      <p className="mb-4 text-sm text-gray-600">
                        Choose which sensors this schedule will control
                      </p>
                      <CheckboxGroup
                        value={scheduleData.sensorIds}
                        onValueChange={(value) =>
                          setScheduleData({ ...scheduleData, sensorIds: value })
                        }
                        orientation="horizontal"
                        isRequired
                        errorMessage={
                          scheduleData.sensorIds.length === 0
                            ? 'At least one sensor must be selected'
                            : ''
                        }
                        isInvalid={scheduleData.sensorIds.length === 0}
                      >
                        <div className="grid grid-cols-1 gap-4">
                          {/* Group sensors by building */}
                          {Object.entries(
                            sensors.reduce(
                              (acc: Record<string, typeof sensors>, sensor) => {
                                if (!acc[sensor.building]) {
                                  acc[sensor.building] = []
                                }
                                acc[sensor.building].push(sensor)
                                return acc
                              },
                              {} as Record<string, typeof sensors>
                            )
                          ).map(([building, buildingSensors]) => (
                            <div
                              key={building}
                              className="rounded-lg border border-divider p-3 bg-content2/50"
                            >
                              <h4 className="mb-3 text-sm font-semibold">
                                {building}
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {buildingSensors.map((sensor) => (
                                  <Checkbox
                                    key={sensor.externalID}
                                    value={sensor.externalID}
                                    size="sm"
                                  >
                                    {sensor.name}
                                  </Checkbox>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CheckboxGroup>
                    </div>
                  </CardBody>
                </Card>

                {/* Render appropriate form based on schedule type */}
                {scheduleData.type === 'recurring'
                  ? renderRecurringScheduleForm(scheduleData)
                  : renderOneTimeScheduleForm(scheduleData)}
              </div>
            </ModalBody>

            <ModalFooter className="flex flex-col sm:flex-row justify-between gap-3 py-4">
              <div>
                {schedule && (
                  <Button
                    color="danger"
                    variant="flat"
                    onPress={handleDelete}
                    isLoading={loading}
                    className="w-full sm:w-auto min-h-[44px]"
                  >
                    Delete Schedule
                  </Button>
                )}
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  color="default"
                  variant="light"
                  onPress={onClose}
                  className="flex-1 sm:flex-none min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onPress={handleSave}
                  isLoading={loading}
                  isDisabled={scheduleData.sensorIds.length === 0 || !scheduleData.name}
                  className="flex-1 sm:flex-none min-h-[44px]"
                >
                  {schedule ? 'Update' : 'Create'}
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
