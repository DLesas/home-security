'use client'

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
import { ScheduleEditor } from './scheduleEditor'

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
                    <ScheduleActions
                      schedule={schedule}
                      setSelectedSchedule={setSelectedSchedule}
                      onOpen={onOpen}
                    />
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

function ScheduleActions({
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
