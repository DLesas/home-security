import { useSocketData, type schedule as scheduleType } from '../socketData'
import { Input } from '@nextui-org/input'
import { Select, SelectItem } from '@nextui-org/select'
import { TimeInput } from '@nextui-org/date-input'
import { Time } from '@internationalized/date'
import { DateInput } from '@nextui-org/date-input'
import { today, getLocalTimeZone, parseDate } from '@internationalized/date'
import { useEffect, useState } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@nextui-org/modal'
import { CheckboxGroup, Checkbox } from '@nextui-org/checkbox'
import { Button } from '@nextui-org/button'

export function ScheduleEditor({
  schedule,
  isOpen,
  onClose,
}: {
  schedule: scheduleType | null
  isOpen: boolean
  onClose: () => void
}) {
  const { data, schedules, isConnected } = useSocketData()
  const [recurrence, setRecurrence] = useState<
    // @ts-ignore
    (typeof schedule)['recurrence'] | undefined
  >(undefined)
  const Hour = schedule?.time ? parseInt(schedule.time.split(':')[0]) : 0
  const Min = schedule?.time ? parseInt(schedule.time.split(':')[1]) : 0

  useEffect(() => {
    if (schedule) {
      setRecurrence(schedule.recurrence)
    }
  }, [schedule])

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              {schedule ? `Ammend ${schedule.name}` : 'New Schedule'}
            </ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
                <div className="flex flex-row">
                  <Input
                    label="Schedule name"
                    isRequired
                    value={schedule?.name}
                  ></Input>
                </div>
                <div className="flex flex-row gap-2">
                  <Select
                    onChange={(e) => {
                      // @ts-ignore
                      setRecurrence(e.target.value)
                    }}
                    selectionMode="single"
                    isRequired
                    value={recurrence}
                    defaultSelectedKeys={schedule ? [schedule?.recurrence] : []}
                    label="Schedule type"
                  >
                    <SelectItem key="One off" value="One off">
                      One off
                    </SelectItem>
                    <SelectItem key="Daily" value="Daily">
                      Daily
                    </SelectItem>
                    <SelectItem key="Weekly" value="Weekly">
                      Weekly
                    </SelectItem>
                  </Select>
                  <Select
                    selectionMode="single"
                    label="Schedule action"
                    isRequired
                    defaultSelectedKeys={schedule ? [schedule?.action] : []}
                  >
                    <SelectItem key="Arm" value="Arm">
                      Arm
                    </SelectItem>
                    <SelectItem key="Disarm" value="Disarm">
                      Disarm
                    </SelectItem>
                  </Select>
                </div>
                <div className="gap flex flex-row gap-2">
                  <Select
                    selectionMode="single"
                    isRequired
                    label="Building"
                    defaultSelectedKeys={schedule ? [schedule?.building] : []}
                  >
                    {Object.keys(data.logs).map((building) => (
                      <SelectItem key={building} value={building}>
                        {building}
                      </SelectItem>
                    ))}
                  </Select>
                  <TimeInput
                    label="Time"
                    isRequired
                    hourCycle={24}
                    defaultValue={new Time(Hour, Min)}
                    granularity="minute"
                    hideTimeZone
                  ></TimeInput>
                </div>
                {recurrence !== 'Daily' && (
                  <div className="flex flex-row">
                    {recurrence === 'Weekly' && (
                      <CheckboxGroup
                        isRequired
                        label="Select days"
                        orientation="horizontal"
                        defaultValue={schedule?.days}
                      >
                        <Checkbox value="Monday">Monday</Checkbox>
                        <Checkbox value="Tuesday">Tuesday</Checkbox>
                        <Checkbox value="Wednesday">Wednesday</Checkbox>
                        <Checkbox value="Thursday">Thursday</Checkbox>
                        <Checkbox value="Friday">Friday</Checkbox>
                        <Checkbox value="Saturday">Saturday</Checkbox>
                        <Checkbox value="Sunday">Sunday</Checkbox>
                      </CheckboxGroup>
                    )}
                    {recurrence === 'One off' && (
                      <DateInput
                        defaultValue={
                          schedule?.date ? parseDate(schedule?.date) : undefined
                        }
                        granularity="day"
                        label="Date"
                        isRequired
                      ></DateInput>
                    )}
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Go back
              </Button>
              <Button color="primary" onPress={onClose}>
                {schedule ? `Save schedule` : 'Save new schedule'}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
