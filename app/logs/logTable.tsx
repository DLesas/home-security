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
import { parseDateTime, toTime, Time } from '@internationalized/date'
import { useState, useEffect, useMemo } from 'react'
import { TimeValue } from 'react-aria-components'
import { Button } from '@nextui-org/button'

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
  const [minTime, setMinTime] = useState<TimeValue | null>(null)
  const [maxTime, setMaxTime] = useState<TimeValue | null>(null)
  const { socket, setUrl, url } = useSocket()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['logTable', building, date],
    queryFn: async () => {
      const response = await fetch(
        `${url}/logs/${building}/${date.day}-${date.month}-${date.year}`
      )
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      const json = (await response.json()) as Log[]
      const parsedLogs = json.map((log) => {
        let parsedDate = new Date(log.date).toISOString()
        parsedDate = parsedDate.replace(/\.\d{3}Z$/, '') // Remove milliseconds and 'Z'
        const parsedTemp = Math.round(log.temp)
        return {
          door: log.door,
          status: log.status,
          temp: parsedTemp,
          time: toTime(parseDateTime(parsedDate)).toString(),
          _time: toTime(parseDateTime(parsedDate)), // Use parseDateTime to get the Time object
          _fullDate: parseDateTime(parsedDate), // Store the parsed date for comparison
        }
      })
      return parsedLogs
    },
  })

  const columns = useMemo(
    () =>
      data?.[0]
        ? Object.keys(data[0]).filter((key) => !key.startsWith('_'))
        : [],
    [data]
  )

  const distinctDoors = useMemo(
    () =>
      [...new Set(data?.map((log) => log.door))].map((door) => ({
        label: door,
      })),
    [data]
  )

  const minTimeAllowed = useMemo(
    () =>
      data?.reduce((min, log) => (log._fullDate < min._fullDate ? log : min))
        ._time,
    [data]
  )

  const maxTimeAllowed = useMemo(
    () =>
      data?.reduce((max, log) => (log._fullDate > max._fullDate ? log : max))
        ._time,
    [data]
  )

  const [dataToShow, setDataToShow] = useState<typeof data | undefined>(
    undefined
  )
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 200

  useEffect(() => {
    if (!data) {
      setDataToShow(undefined)
      return
    }

    let filteredData = data

    if (minTime) {
      filteredData = filteredData.filter((log) => log._time >= minTime)
    }

    if (maxTime) {
      filteredData = filteredData.filter((log) => log._time <= maxTime)
    }

    if (door) {
      filteredData = filteredData.filter((log) => log.door === door)
    }

    setDataToShow(filteredData)
    setCurrentPage(1) // Reset to the first page whenever the filter changes
  }, [data, minTime, maxTime, door])

  const paginatedData = useMemo(() => {
    if (!dataToShow) return []
    const startIndex = (currentPage - 1) * itemsPerPage
    return dataToShow.slice(startIndex, startIndex + itemsPerPage)
  }, [dataToShow, currentPage])

  const totalPages = useMemo(() => {
    return dataToShow ? Math.ceil(dataToShow.length / itemsPerPage) : 1
  }, [dataToShow])

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
  }

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1))
  }

  const Element = (
    <>
      {isLoading ? (
        <div>Loading...</div>
      ) : isError ? (
        <div>Error: {error.message}</div>
      ) : (
        dataToShow && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-row justify-around gap-2">
              <Select
                onChange={(val) => setDoor(val.target.value)}
                variant="bordered"
                label="Select a door"
                items={distinctDoors!}
              >
                {(door) => (
                  <SelectItem key={door.label}>{door.label}</SelectItem>
                )}
              </Select>
              <TimeInput
                onChange={(val) => setMinTime(val)}
                variant="bordered"
                minValue={minTimeAllowed}
                maxValue={maxTimeAllowed}
                label="Min Time"
              ></TimeInput>
              <TimeInput
                onChange={(val) => setMaxTime(val)}
                variant="bordered"
                minValue={minTimeAllowed}
                maxValue={maxTimeAllowed}
                label="Max Time"
              ></TimeInput>
            </div>
            <div className="flex flex-row justify-around gap-2">
              <Button color='primary' variant={currentPage === 1? 'faded' : 'solid'} onClick={handlePreviousPage} disabled={currentPage === 1}>
                Previous
              </Button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <Button
              color='primary'
              variant='solid'
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
            <Table
              removeWrapper
              aria-label="Example table with dynamic content"
            >
              <TableHeader>
                {columns.map((column) => (
                  <TableColumn key={column}>{column}</TableColumn>
                ))}
              </TableHeader>
              <TableBody>
                {paginatedData.map((log, index) => (
                  <TableRow
                    key={`${index}_${log.time}_${log.door}_${log.temp}`}
                  >
                    {(columnKey) => (
                      <TableCell>{getKeyValue(log, columnKey)}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
          </div>
        )
      )}
    </>
  )

  return <>{Element}</>
}
