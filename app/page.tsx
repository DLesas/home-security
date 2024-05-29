'use client'
import { Button, ButtonProps } from '@nextui-org/button'
import { useEffect, useState } from 'react'

const example = {
  armed: false,
  alarm: false,
  logs: {
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
  },
}

type data = typeof example

export default function Index() {
  const [data, setData] = useState<data>(example)
  const [armed, setArmed] = useState(false)
  const [buttons, setButtons] = useState([
    {
      name: 'test',
      loading: false,
      color: 'primary',
      function: test,
    },
    { name: 'disarm', loading: false, color: 'success', function: disarm },
    { name: 'arm', loading: false, color: 'danger', function: arm },
  ])

  async function test() {
    // send a request to '192.168.5.157' + ':5000' + '/test'
    console.log('testing')
    const res = await fetch(
      'http://' + process.env.NEXT_PUBLIC_IP + ':5000/test'
    )
    const json = await res.json()
    return json['success']
  }
  async function disarm() {
    // send a request to '192.168.5.157' + ':5000' + '/disarm'
    console.log('disarming')
    const res = await fetch(
      'http://' + process.env.NEXT_PUBLIC_IP + ':5000/disarm'
    )
    setArmed(false)
    const json = await res.json()
    return json['success']
  }

  async function arm() {
    // send a request to '192.168.5.157' + ':5000' + '/arm'
    console.log('arming')
    const res = await fetch(
      'http://' + process.env.NEXT_PUBLIC_IP + ':5000/arm'
    )
    setArmed(true)
    const json = await res.json()
    return json['success']
  }

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
    // const socket = new WebSocket(
    //   'ws://' + process.env.NEXT_PUBLIC_IP + ':5000' + '/logs'
    // )
    const socket = new WebSocket(
      'ws://' + process.env.NEXT_PUBLIC_IP + ':5000' + '/logs'
    )
    socket.addEventListener('message', (ev) => {
      setData(JSON.parse(ev.data))
      console.log(JSON.parse(ev.data))
    })
    return () => {
      socket.close()
    }
  }, [])

  return (
    <div className="mt-10 flex justify-center">
      <div className="flex w-full flex-col items-center justify-between gap-28">
        <div className="flex flex-col items-center">
          <div>
            system is{' '}
            {armed ? (
              <span className="text-red-400"> armed </span>
            ) : (
              <span className="text-green-400">disarmed</span>
            )}
          </div>
        </div>
        <div className="flex w-2/5 flex-col gap-5">
          {buttons.map((button) => (
            <Button
              variant="solid"
              color={button.color as ButtonProps['color']}
              key={button.name}
              isLoading={button.loading}
              onPress={async () => {
                setButtons((prevButtons) =>
                  prevButtons.map((btn) =>
                    btn.name === button.name ? { ...btn, loading: true } : btn
                  )
                )
                const res = await button.function()
                setButtons((prevButtons) =>
                  prevButtons.map((btn) =>
                    btn.name === button.name ? { ...btn, loading: false } : btn
                  )
                )
              }}
            >
              {button.name}
            </Button>
          ))}
        </div>
        <div className="flex flex-row">info boxes coming here soon</div>
      </div>
    </div>
  )
}
