'use client'
import { Button, ButtonProps } from '@nextui-org/button'
import { useEffect, useState } from 'react'
import { Card, CardHeader } from '@nextui-org/card'
import { socket } from '@/lib/socket'
import { FaCircle, FaRegCircle } from 'react-icons/fa6'
import usePushNotifications from './usePushNotifications'


type LogStatus = 'open' | 'closed' // Define the possible log status values

interface DoorValues {
  status: LogStatus
  armed: boolean
}

interface DoorEntries {
  [key: string]: DoorValues
}

interface Example {
  alarm: boolean
  logs: {
    [key: string]: DoorEntries | {}
  }
  issues:
    | {
        msg: string
        time: Date
        id: string
      }[]
    | [] // Update to allow for an empty array
}

// const example = {
//   alarm: false,
//   logs: {
//     House: {
//       'Back door': {
//         status: 'closed',
//       },
//       'Dining room': {
//         status: 'closed',
//       },
//       'Front door': {
//         status: 'closed',
//       },
//       'Living room': {
//         status: 'closed',
//       },
//     },
//   },
//   issues: [{ msg: 'test', time: new Date() }],
// }

type data = Example

function countDoorEntriesBuilding(
  data: data,
  building: string
): { armed: number; disarmed: number } {
  let armedCount = 0
  let disarmedCount = 0

  for (const door in data.logs[building]) {
    // @ts-ignore
    if (data.logs[building][door].armed) {
      armedCount++
    } else {
      disarmedCount++
    }
  }

  return { armed: armedCount, disarmed: disarmedCount }
}

function countDoorEntries(data: data): { armed: number; disarmed: number } {
  let armedCount = 0
  let disarmedCount = 0

  if (data.logs == undefined) {
    return { armed: 0, disarmed: 0 }
  }
  for (const building in data.logs) {
    for (const door in data.logs[building]) {
      // @ts-ignore
      if (data.logs[building][door].armed) {
        armedCount++
      } else {
        disarmedCount++
      }
    }
  }

  return { armed: armedCount, disarmed: disarmedCount }
}

function checkArmedState({
  armed,
  disarmed,
}: {
  armed: number
  disarmed: number
}) {
  if (armed == 0 && disarmed == 0) {
    return 'Unknown'
  } else if (armed > 0 && disarmed > 0) {
    return 'Partially armed'
  } else if (armed > 0 && disarmed == 0) {
    return 'Armed'
  } else if (armed == 0 && disarmed > 0) {
    return 'Disarmed'
  }
}

export default function Index() {
  const [data, setData] = useState<data>({} as data)
  const [isConnected, setIsConnected] = useState(false)
  const armed = checkArmedState(countDoorEntries(data))

  const publicVapidKey = process.env.VAPID_PUBLIC!;
  usePushNotifications(publicVapidKey);

  // async function test(callback: () => void) {
  //   // send a request to '192.168.5.157' + ':5000' + '/test'
  //   console.log('testing')
  //   socket.timeout(5000).emit('test', 'test', callback)
  // }
  function disarm(callback: () => void, subject: String) {
    // send a request to '192.168.5.157' + ':5000' + '/disarm'
    console.log('disarming')
    socket.timeout(5000).emit('disarm/building', subject, callback)
  }

  function arm(callback: () => void, subject: String) {
    // send a request to '192.168.5.157' + ':5000' + '/arm'
    console.log('arming')
    socket.timeout(5000).emit('arm/building', subject, callback)
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

  // useEffect(() => {
  //   const fetchData = async () => {
  //     const res = await fetch('http://' + process.env.NEXT_PUBLIC_IP + ':5000' + '/log')
  //     const resJson = await res.json()
  //     setData(resJson)
  //   }
  //   fetchData();
  // }, [])

  useEffect(() => {
    function onConnect() {
      setIsConnected(true)
    }

    function onDisconnect() {
      setIsConnected(false)
    }

    function onData(value: data) {
      setData(value)
    }
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('data', onData)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('data', onData)
    }
  }, [])

  return (
    <div className="mt-10 flex justify-center">
      <div className="flex w-full flex-col items-center justify-between gap-32">
        <div className="flex flex-col items-center text-lg font-semibold">
          <div>
            {isConnected ? (
              <span className="flex flex-row items-center gap-2 text-green-400">
                <FaCircle size={12}></FaCircle> Connected{' '}
              </span>
            ) : (
              <span className="flex flex-row items-center gap-2 text-red-400">
                <FaRegCircle size={12}></FaRegCircle> Disconnected{' '}
              </span>
            )}
          </div>
          <div>
            System is{' '}
            {armed === 'Armed' ? (
              <span className="text-red-400">armed</span>
            ) : armed === 'Disarmed' ? (
              <span className="text-green-400">disarmed</span>
            ) : armed === 'Partially armed' ? (
              <span className="text-yellow-400">partially armed</span>
            ) : (
              <span>unknown</span>
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
        {/* <div className="flex w-4/5 flex-row justify-around gap-3"></div> */}
        <div className="flex w-full flex-row justify-center">
          <div className="flex w-4/5 flex-col gap-4">
            {/* <div className="text-lg">Door logs</div> */}
            <div className="flex flex-col gap-8">
              {data.logs &&
                Object.keys(data.logs).map((key) => (
                  <LogCard
                    logKey={key}
                    data={data}
                    checkArmedState={checkArmedState}
                    countDoorEntriesBuilding={countDoorEntriesBuilding}
                    arm={arm}
                    disarm={disarm}
                  ></LogCard>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

type armedstatefunc = typeof checkArmedState

type LogCardProps = {
  logKey: string
  data: Example
  checkArmedState: typeof checkArmedState
  countDoorEntriesBuilding: typeof countDoorEntriesBuilding
  arm: (callback: () => void, subject: String) => void
  disarm: (callback: () => void, subject: String) => void
}

const LogCard: React.FC<LogCardProps> = ({
  logKey,
  data,
  checkArmedState,
  countDoorEntriesBuilding,
  arm,
  disarm,
}) => {
  const [buttons, setButtons] = useState([
    { name: 'Arm', loading: false, color: 'danger', function: arm },
    { name: 'Disarm', loading: false, color: 'success', function: disarm },
  ])

  const armStatus = checkArmedState(countDoorEntriesBuilding(data, logKey))

  const cardClassName =
    'flex w-full flex-col gap-6 p-4 shadow-2xl ' +
    (armStatus === 'Armed'
      ? 'shadow-red-400/60'
      : armStatus === 'Disarmed'
        ? 'shadow-green-400/60'
        : 'shadow-yellow-400/60')

  return (
    <Card className={cardClassName}>
      <div className="flex flex-row justify-around px-10 text-center text-lg">
        <span>{logKey}</span>
      </div>
      <div className="flex flex-row justify-around text-center">
        {data.logs[logKey] &&
          Object.keys(data.logs[logKey]).map((key2) => (
            <div
              key={key2}
              className="flex flex-col gap-4 text-ellipsis text-nowrap text-sm font-light"
            >
              <span className="">{key2}</span>
              <div className="font-bold">
                {
                  //@ts-ignore
                  data.logs[logKey][key2] &&
                  //@ts-ignore
                  data.logs[logKey][key2].status === 'open' ? (
                    <span className="text-danger-400">Open</span>
                  ) : (
                    <span className="text-success-400">Closed</span>
                  )
                }
              </div>
            </div>
          ))}
      </div>
      <div className="flex flex-row justify-around">
        {buttons.map((button) => (
          <Button
            variant={
              armStatus!.slice(0, -2) === button.name ? 'solid' : 'ghost'
            }
            color={button.color as ButtonProps['color']}
            key={button.name}
            isLoading={button.loading}
            onPress={async () => {
              setButtons((prevButtons) =>
                prevButtons.map((btn) =>
                  btn.name === button.name ? { ...btn, loading: true } : btn
                )
              )
              const res = await button.function(
                () =>
                  setButtons((prevButtons) =>
                    prevButtons.map((btn) =>
                      btn.name === button.name
                        ? { ...btn, loading: false }
                        : btn
                    )
                  ),
                logKey
              )
            }}
          >
            {armStatus!.slice(0, -2) === button.name ? armStatus : button.name}
          </Button>
        ))}
      </div>
    </Card>
  )
}
