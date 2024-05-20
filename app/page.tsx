'use client'
import { useEffect, useState } from 'react'
import { Card, CardHeader, CardBody, CardFooter } from '@nextui-org/card'
import { Divider } from '@nextui-org/divider'
import { cn } from '@/lib/utils'

const example = {
  backDoor: {
    date: '18-05-2024 19:49:05',
    door_state: 'closed',
    temperature: 31.2577,
  },
  frontDoor: {
    date: '18-05-2024 19:49:05',
    door_state: 'open',
    temperature: 29.85327,
  },
  'livingRoom-frenchDoor1': {
    date: '18-05-2024 19:49:05',
    door_state: 'closed',
    temperature: 33.59842,
  },
  'livingRoom-frenchDoor2': {
    date: '18-05-2024 19:49:05',
    door_state: 'closed',
    temperature: 41.5569,
  },
}

type data = typeof example

function SensorCard({
  name,
  door_state,
  temperature,
}: {
  name: string
  door_state: string
  temperature: number
}) {
  return (
    <Card
      className={`max-w-[400px] ${door_state === 'open' ? 'bg-red-500' : ''}  `}
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
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(
          `http://${process.env.NEXT_PUBLIC_IP}:5000/logs`,
          {
            method: 'GET',
          }
        )
        const data: data = await response.json()
        setData(data)
        // You might need to handle the response based on the actual content type
      } catch (error) {
        console.error('Error fetching sensor data:', error)
      }
    }, 500)

    // Clean up intervals on component unmount
    return () => {
      clearInterval(intervalId)
    }
  }, [])

  return (
    <div className="flex flex-row justify-center">
      <div className="flex w-8/12 flex-1 flex-col items-center justify-center gap-20">
        {Object.entries(data).map(([key, value]) => (
          <SensorCard
            key={key}
            name={key}
            door_state={value.door_state}
            temperature={value.temperature}
          />
        ))}
      </div>
    </div>
  )
}
