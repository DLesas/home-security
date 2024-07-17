'use client'

import { today, getLocalTimeZone, parseDate } from '@internationalized/date'
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  getKeyValue,
} from '@nextui-org/table'
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownSection,
  DropdownItem,
} from '@nextui-org/dropdown'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@nextui-org/modal'
import { CheckboxGroup, Checkbox } from '@nextui-org/checkbox'
import { useSocketData, type schedule as scheduleType } from '../socketData'
import { Button } from '@nextui-org/button'
import { SlOptionsVertical } from 'react-icons/sl'
import { useEffect, useState } from 'react'
import { Input } from '@nextui-org/input'
import { Select, SelectItem } from '@nextui-org/select'
import { TimeInput } from '@nextui-org/date-input'
import { Time } from '@internationalized/date'
import { DateInput } from '@nextui-org/date-input'

export default function App() {
  const { data, schedules, isConnected } = useSocketData()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [selectedSchedule, setSelectedSchedule] = useState<scheduleType | null>(
    null
  )
  console.log(schedules)
  let cols = [
    'name',
    'building',
    'action',
    'time',
    'recurrence',
    'actions',
    'date',
    'days',
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-row">
        <h1>current Schedules</h1>{' '}
        <Button
          onPress={() => {
            setSelectedSchedule(null)
            onOpen()
          }}
        >
          New
        </Button>
      </div>
      <Table
        className="overflow-x-auto"
        removeWrapper
        aria-label="Schedules table"
      >
        <TableHeader>
          {cols.map((column) => (
            <TableColumn key={column}>{column}</TableColumn>
          ))}
        </TableHeader>
        <TableBody>
          {schedules.map((schedule, index) => (
            <TableRow key={`${index}_${schedule.name}`}>
              {(columnKey) =>
                columnKey === 'actions' ? (
                  <TableCell>
                    {scheduleActions({ schedule, setSelectedSchedule, onOpen })}
                  </TableCell>
                ) : (
                  <TableCell>{getKeyValue(schedule, columnKey)}</TableCell>
                )
              }
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ScheduleEditor
        schedule={selectedSchedule}
        isOpen={isOpen}
        onClose={onClose}
      />
    </div>
  )
}

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
                          schedule?.date
                            ? parseDate(schedule?.date)
                            : undefined
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

export function scheduleActions({
  schedule,
  setSelectedSchedule,
  onOpen,
}: {
  schedule: scheduleType
  setSelectedSchedule: (schedule: scheduleType | null) => void
  onOpen: () => void
}) {
  const name = schedule.name

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button isIconOnly variant="light">
          <SlOptionsVertical></SlOptionsVertical>
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
          Ammend
        </DropdownItem>
        <DropdownItem key="delete" className="text-danger" color="danger">
          Delete
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}
