'use client'

import { Select, SelectItem } from '@nextui-org/select'
import { BsFillHouseFill } from 'react-icons/bs'
import { useSocketData } from '../socketData'
import { DatePicker } from '@nextui-org/date-picker'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSocket } from '../socketInitializer'
import { CalendarDate, DateValue, isSameDay } from '@internationalized/date'
import { LogTable } from './logTable'

const LogPage: React.FC = () => {
  const [Building, setBuilding] = useState<string | null>(null)
  const [date, setDate] = useState<DateValue | null>(null)
  const { socket, setUrl, url } = useSocket()
  const { data: socketData, isConnected } = useSocketData()
  // useQuery({
  //   queryKey: ['logs', Building, date],
  //   queryFn: async () => {
  //     const data = await fetchTodoById(todoId)
  //     return data
  //   },
  // })

  const { data } = useQuery({
    queryKey: ['logDates'],
    queryFn: async () => {
      const data = await fetch(`${url}/log/dates`)
      const dates = await data.json()
      console.log(dates)
      const parsedDates = dates.map((dateString: string) => {
        const [day, month, year] = dateString.split('_')
        return new CalendarDate(parseInt(year), parseInt(month), parseInt(day))
      })
      return parsedDates as DateValue[]
    },
  })

  return (
    <div className="flex flex-col gap-6 px-3">
      <div className="flex flex-row justify-around gap-6">
        <Select
          label="Building"
          onChange={(e) => setBuilding(e.target.value)}
          isRequired
          variant="bordered"
          placeholder="Select a building"
        >
          {socketData.logs &&
            Object.keys(socketData.logs).map((key) => (
              <SelectItem key={key}>{key}</SelectItem>
            ))}
        </Select>
        <DatePicker
          isRequired
          onChange={(date) => setDate(date)}
          isDateUnavailable={(date) => {
            if (data) {
              const parsedDates = data // Assuming data is an array of Date objects
              return parsedDates.some((parsedDate) => {
                // Compare dates in a way that works for your use case
                isSameDay(parsedDate, date)
              })
            }
            return true // Return true if data is not available
          }}
          label="Log Date"
          variant="bordered"
        />
      </div>
      <div>
        {Building && date ? (
          <div>
            <LogTable building={Building} date={date} />
          </div>
        ) : (
          <div className="text-center">
            {' '}
            please select a building and a date
          </div>
        )}
      </div>
    </div>
  )
}

export default LogPage
