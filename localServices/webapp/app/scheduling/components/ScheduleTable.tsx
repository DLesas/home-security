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
  DropdownItem,
} from '@nextui-org/dropdown'
import { Button } from '@nextui-org/button'
import { SlOptionsVertical } from 'react-icons/sl'
import { type schedule as scheduleType } from '../../socketData'

interface ScheduleTableProps {
  schedules: scheduleType[]
  setSelectedSchedule: (schedule: scheduleType | null) => void
  onOpen: () => void
  onDelete?: (schedule: scheduleType) => void
}

export function ScheduleTable({
  schedules,
  setSelectedSchedule,
  onOpen,
  onDelete,
}: ScheduleTableProps) {
  const cols = [
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
                    onDelete={onDelete}
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
  )
}

function ScheduleActions({
  schedule,
  setSelectedSchedule,
  onOpen,
  onDelete,
}: {
  schedule: scheduleType
  setSelectedSchedule: (schedule: scheduleType | null) => void
  onOpen: () => void
  onDelete?: (schedule: scheduleType) => void
}) {
  return (
    <Dropdown>
      <DropdownTrigger>
        <Button isIconOnly variant="light">
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
          onPress={() => onDelete && onDelete(schedule)}
        >
          Delete
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}
