import { DateValue } from '@internationalized/date'
import { useQuery } from '@tanstack/react-query'
import { useSocket } from '../socketInitializer'
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  getKeyValue,
} from '@nextui-org/table'
import { TimeInput } from '@nextui-org/date-input'
import { Select, SelectItem } from '@nextui-org/select'
import {
  CalendarDateTime,
  parseDateTime,
  toTime,
  Time,
} from '@internationalized/date'
import { useState } from 'react'

interface Log {
  status: string
  temp: number
  door: string
  building: string
  date: number
}

export function LogTable({
  building,
  date,
}: {
  building: string
  date: DateValue
}) {
  const [door, setDoor] = useState<string | null>(null)
  const [minTime, setMinTime] = useState<Time | null>(null)
  const [maxTime, setMaxTime] = useState<Time | null>(null)
  const { socket, setUrl, url } = useSocket()
  const { data, isLoading } = useQuery({
    queryKey: ['logTable', building, date],
    queryFn: async () => {
      const data = await fetch(
        `${url}/logs/${building}/${date.day}-${date.month}-${date.year}`
      )
      const json = (await data.json()) as Log[]
      const parsedLogs = json.map((log) => {
        const parsedDate = parseDateTime(new Date(log.date).toISOString())
        const parsedTemp = Math.round(log.temp)
        return {
          door: log.door,
          status: log.status,
          temp: parsedTemp,
          time: toTime(parsedDate),
          _fullDate: parsedDate,
        }
      })
      return parsedLogs
    },
  })

  const dataToShow = data?.filter((log) => {
      log.time >= minTime? && log.time <= maxTime?
  })
  const columns = data?.[0]
    ? Object.keys(data[0]).filter((key) => !key.startsWith('_'))
    : []
  const distinctDoors = [...new Set(data?.map((log) => log.door))].map(
    (door) => ({ label: door })
  )
  const minTimeAllowed = data?.reduce((min, log) => {
    return log._fullDate < min._fullDate ? log : min
  }).time

  const maxTimeAllowed = data?.reduce((max, log) => {
    return log._fullDate > max._fullDate ? log : max
  }).time

  const Element = isLoading ? (
    <div>Loading...</div>
  ) : (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row justify-around gap-2">
        <Select
          onChange={(val) => setDoor(val.target.value)}
          variant="bordered"
          label="Select a door"
          items={distinctDoors!}
        >
          {(door) => <SelectItem key={door.label}>{door.label}</SelectItem>}
        </Select>
        <TimeInput
          onChange={(val) => setMinTime(val as Time)}
          variant="bordered"
          minValue={minTimeAllowed}
          maxValue={maxTimeAllowed}
          label="Min Time"
        ></TimeInput>
        <TimeInput
          onChange={(val) => setMaxTime(val as Time)}
          variant="bordered"
          minValue={minTimeAllowed}
          maxValue={maxTimeAllowed}
          label="Max Time"
        ></TimeInput>
      </div>
      <Table removeWrapper aria-label="Example table with dynamic content">
        <TableHeader>
          {columns.map((column) => (
            <TableColumn key={column}>{column}</TableColumn>
          ))}
        </TableHeader>
        <TableBody>
          {dataToShow!.map((log) => (
            <TableRow key={`${log.time} ${log.door} ${log.temp}`}>
              {(columnKey) => (
                <TableCell>{getKeyValue(log, columnKey)}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )

  return <>{Element}</>
}
