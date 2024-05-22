'use client'
import { useEffect, useState } from 'react'
import { Card, CardHeader, CardBody, CardFooter } from '@nextui-org/card'
import { Divider } from '@nextui-org/divider'
import { cn } from '@/lib/utils'
import humanizeDuration from 'humanize-duration'
const example = {
  House: {
    'Back door': {
      status: 'closed',
      temp: 28.44887,
      time: 'Wed, 22 May 2024 00:08:59 GMT',
    },
    'Dining room - French door': {
      status: 'closed',
      temp: 28.91698,
      time: 'Wed, 22 May 2024 00:08:59 GMT',
    },
    'Front door': {
      status: 'closed',
      temp: 28.91698,
      time: 'Wed, 22 May 2024 00:08:59 GMT',
    },
    'Living room - French door': {
      status: 'closed',
      temp: 31.72584,
      time: 'Wed, 22 May 2024 00:08:59 GMT',
    },
  },
}

type data = typeof example

function SensorCard({
  name,
  door_state,
  temperature,
  time,
}: {
  name: string
  door_state: string
  temperature: number
  time: string
}) {
  const date = new Date(time)
  date.setHours(date.getHours())
  return (
    <Card
      className={`${door_state === 'open' ? 'bg-red-500' : ''}  col-span-4`}
    >
      <CardHeader className="flex gap-3">
        <div className="flex flex-col">
          <p className="text-md">{name}</p>
        </div>
      </CardHeader>
      <Divider />
      <CardBody>
        <p> {door_state} </p>
      </CardBody>
      <Divider />
      <CardFooter>
        <p> {temperature} </p>
      </CardFooter>
      <div>
        {humanizeDuration(new Date() - date, {
          units: ['s', 'ms'],
          round: true,
        })}
      </div>
      <div>{new Date().toLocaleTimeString()}</div>
      <div>{date.toLocaleTimeString()}</div>
    </Card>
  )
}

export default function Index() {
  const [data, setData] = useState<data>(example)

  //   const doorSensors = [
  //     {
  //         "name": "[Pico] livingRoom-frenchDoor1",
  //         "delay": 0.2,
  //         "mac": "28-CD-C1-0F-33-3A",
  //         "potentialIP": "192.168.1.111",
  //         source: '/api/sensor2',
  //         timeout: undefined,
  //         currentData : {}
  //     },
  //     {
  //         "name": "[Pico] livingRoom-frenchDoor2",
  //         "delay": 0.2,
  //         "mac": "28-CD-C1-0F-31-62",
  //         "potentialIP": "192.168.1.241",
  //         source: '/api/sensor1',
  //         timeout: undefined,
  //         currentData : {}
  //     },
  //     {
  //         "name": "[Pico] backDoor",
  //         "delay": 0.2,
  //         "mac": "28-CD-C1-0F-34-5E",
  //         "potentialIP": "192.168.1.191",
  //         source: '/api/sensor3',
  //         timeout: undefined,
  //         currentData : {}
  //     },
  //     {
  //         "name": "[Pico] frontDoor",
  //         "delay": 0.2,
  //         "mac": "28-CD-C1-0F-2B-25",
  //         "potentialIP": "192.168.1.75",
  //         source: '/api/sensor4',
  //         timeout: undefined,
  //         currentData : {}
  //     },
  // ]

  useEffect(() => {
    const socket = new WebSocket(
      'ws://' + process.env.NEXT_PUBLIC_IP + ':5000' + '/echo'
    )
    socket.addEventListener('message', (ev) => {
      setData(JSON.parse(ev.data))
    })
    // const intervalId = setInterval(async () => {
    //   try {
    //     const response = await fetch(
    //       `http://${process.env.NEXT_PUBLIC_IP}:5000/logs`,
    //       {
    //         method: 'GET',
    //       }
    //     )
    //     const data: data = await response.json()

    //     setData(data)
    //     // You might need to handle the response based on the actual content type
    //   } catch (error) {
    //     console.error('Error fetching sensor data:', error)
    //   }
    // }, 10)

    // // Clean up intervals on component unmount
    // return () => {
    //   clearInterval(intervalId)
    // }
    return () => {
      socket.close()
    }
  }, [])

  return (
    <div className="flex justify-center">
      <div className="grid w-8/12 grid-cols-8 grid-rows-6 gap-4">
        <div className="col-span-8 lg:col-span-2">
          <div>
            <div className="flex flex-row justify-center">
              {Object.entries(data).map(([key, value]) => (
                <div className="grid grid-cols-8 gap-8">
                  {' '}
                  {key}
                  {Object.entries(value).map(([nestedKey, nestedValue]) => (
                    <SensorCard
                      key={nestedKey}
                      name={nestedKey}
                      door_state={nestedValue.status}
                      temperature={nestedValue.temp}
                      time={nestedValue.time}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-span-3 col-start-3 row-span-3">2</div>
        <div className="col-span-2 col-start-6 row-span-3">3</div>
        <div className="col-span-3 col-start-5 row-span-3 row-start-4">4</div>
        <div className="col-span-2 col-start-3 row-span-3 row-start-4">5</div>
      </div>
    </div>
  )
}
