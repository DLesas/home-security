'use client'
import { Button, ButtonProps } from '@nextui-org/button'
import { useEffect, useState } from 'react'
import { Card, CardHeader } from '@nextui-org/card'

type LogStatus = 'open' | 'closed' // Define the possible log status values

interface LogEntry {
  status: LogStatus
}

interface LogEntries {
  [key: string]: LogEntry
}

interface Example {
  armed: boolean
  alarm: boolean
  logs: {
    [key: string]: LogEntries
  }
  issues:
    | {
        msg: string
        time: Date
      }[]
    | [] // Update to allow for an empty array
}

const example = {
  armed: false,
  alarm: false,
  logs: {
    House: {
      'Back door': {
        status: 'closed',
      },
      'Dining room': {
        status: 'closed',
      },
      'Front door': {
        status: 'closed',
      },
      'Living room': {
        status: 'closed',
      },
    },
  },
  issues: [{ msg: 'test', time: new Date() }],
}

type data = Example

export default function Index() {
  const [data, setData] = useState<data>(example as data)
  const [buttons, setButtons] = useState([
    {
      name: 'Test',
      loading: false,
      color: 'primary',
      function: test,
    },
    { name: 'Arm', loading: false, color: 'danger', function: arm },
    { name: 'Disarm', loading: false, color: 'success', function: disarm },
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
    const json = await res.json()
    return json['success']
  }

  async function arm() {
    // send a request to '192.168.5.157' + ':5000' + '/arm'
    console.log('arming')
    const res = await fetch(
      'http://' + process.env.NEXT_PUBLIC_IP + ':5000/arm'
    )
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
    const fetchData = async () => {
      const res = await fetch('http://' + process.env.NEXT_PUBLIC_IP + ':5000' + '/log')
      const resJson = await res.json()
      setData(resJson)
    }
    fetchData();
  }, [])

  useEffect(() => {
    // const socket = new WebSocket(
    //   'ws://' + process.env.NEXT_PUBLIC_IP + ':5000' + '/logs'
    // )
    console.log('fired')
    const socket = new WebSocket(
      'ws://' + process.env.NEXT_PUBLIC_IP + ':5000' + '/wslogs'
    )
    socket.onopen = function(e) {
      console.log("[open] Connection established");
    };
    
    socket.onmessage = function(event) {
      console.log(`[message] Data received from server: ${event.data}`);
    };
    
    socket.onclose = function(event) {
      if (event.wasClean) {
        console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
      } else {
        console.log(event)
        console.log('[close] Connection died');
      }
    };
    return () => {
      socket.close()
    }
  }, [])

  return (
    <div className="mt-10 flex justify-center">
      <div className="flex w-full flex-col items-center justify-between gap-32">
        <div className="flex flex-col items-center text-lg font-semibold">
          <div>
            System is{' '}
            {data.armed ? (
              <span className="text-red-400"> armed </span>
            ) : (
              <span className="text-green-400">disarmed</span>
            )}
          </div>
          <div>
            Alarm is{' '}
            {data.alarm ? (
              <span className="text-red-400"> playing </span>
            ) : (
              <span className="text-green-400">not playing</span>
            )}
          </div>
        </div>
        <div className="flex flex-row gap-3">
          {buttons.map((button) => (
            <Button
              variant="solid"
              size="lg"
              className="w-24"
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
        <div className="flex flex-col gap-4">
          <div className="text-lg">Door logs</div>
          <div className="flex flex-col gap-4">
            {Object.keys(data.logs).map((key) => (
              <Card key={key} className="flex flex-col gap-4 p-2">
                <span className="text-center text-lg">{key}</span>
                <div className="flex flex-row justify-around gap-6">
                  {Object.keys(data.logs[key]).map((key2) => (
                    <div
                      key={key2}
                      className="flex flex-col gap-4 text-center text-sm font-light"
                    >
                      <span className="flex flex-row">{key2}</span>
                      <div className="font-bold">
                        {data.logs[key][key2].status == 'open' ? (
                          <span className="text-danger-400">Open</span>
                        ) : (
                          <span className="text-success-400">Closed</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
