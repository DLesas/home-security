'use client'

import { Button, ButtonProps } from '@nextui-org/button'
import { useEffect, useState } from 'react'
import { Card, CardHeader } from '@nextui-org/card'
import { FaCircle, FaRegCircle } from 'react-icons/fa6'
// import usePushNotifications from './usePushNotifications'
import { useSocket } from '../socketInitializer'
import { useSocketData } from '../socketData'
import { useRouter } from 'next/navigation'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@nextui-org/modal'

type LogStatus = 'open' | 'closed'

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

type Data = Example

function countDoorEntriesBuilding(
  data: Data,
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

function checkBuildingOpen(data: Data, building: string) {
  for (const door in data.logs[building]) {
    // @ts-ignore
    if (data.logs[building][door].status == 'open') {
      return 'open' as const
    }
    // @ts-ignore
    if (data.logs[building][door].status == 'unknown') {
      return 'unknown' as const
    }
  }
  return 'closed' as const
}

function countDoorEntries(data: Data): { armed: number; disarmed: number } {
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
  const router = useRouter()
  const { data, isConnected } = useSocketData()
  const armed = checkArmedState(countDoorEntries(data))

  const publicVapidKey = process.env.VAPID_PUBLIC!
  // usePushNotifications(publicVapidKey)

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
        <div className="flex w-full flex-row justify-center">
          <div className="flex w-4/5 flex-col gap-4">
            <div className="flex flex-col gap-8">
              {data.logs &&
                Object.keys(data.logs).map((key) => (
                  <LogCard key={key} logKey={key} data={data} />
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

type LogCardProps = {
  logKey: string
  data: Example
}

const LogCard: React.FC<LogCardProps> = ({ logKey, data }) => {
  const buildingOpen = checkBuildingOpen(data, logKey)
  const { socket } = useSocket()
  const [buttons, setButtons] = useState([
    { name: 'Arm', loading: false, color: 'danger', function: arm },
    { name: 'Disarm', loading: false, color: 'success', function: disarm },
  ])
  const { isOpen, onOpen, onOpenChange } = useDisclosure()
  const armStatus = checkArmedState(countDoorEntriesBuilding(data, logKey))

  const cardClassName =
    'flex w-full flex-col gap-6 p-4 shadow-2xl ' +
    (armStatus === 'Armed'
      ? 'shadow-red-400/60'
      : armStatus === 'Disarmed'
        ? 'shadow-green-400/60'
        : 'shadow-yellow-400/60')

  function disarm(subject: String) {
    if (socket) {
      console.log('disarming')
      socket
        .timeout(5000)
        .emit('disarm/building', subject, () =>
          setButtons((prevButtons) =>
            prevButtons.map((btn) =>
              btn.name === 'Disarm' ? { ...btn, loading: false } : btn
            )
          )
        )
    }
  }

  function arm(
    subject: String,
    buildState: typeof buildingOpen,
    force?: Boolean
  ) {
    force = force || false
    console.log('force is', force)
    console.log('building is', buildingOpen)
    if ((buildState === 'open' || buildState === 'unknown') && !force) {
      onOpen()
      return
    }
    if (socket) {
      console.log('arming')
      socket
        .timeout(5000)
        .emit('arm/building', subject, () =>
          setButtons((prevButtons) =>
            prevButtons.map((btn) =>
              btn.name === 'Arm' ? { ...btn, loading: false } : btn
            )
          )
        )
    }
  }

  return (
    <Card className={cardClassName}>
      <div className="flex flex-row justify-around px-10 text-center text-lg">
        <span>{logKey} </span>
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
                  // @ts-ignore
                  data.logs[logKey][key2] &&
                  // @ts-ignore
                  data.logs[logKey][key2].status === 'open' ? (
                    <span className="text-danger-400">Open</span>
                  ) : // @ts-ignore
                  data.logs[logKey][key2].status === 'closed' ? (
                    <span className="text-success-400">Closed</span>
                  ) : (
                    <span className="text-gray-400">Unknown</span>
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
              button.function(logKey, buildingOpen, false)
            }}
          >
            {armStatus!.slice(0, -2) === button.name ? armStatus : button.name}
          </Button>
        ))}
      </div>
      <Modal
        isOpen={isOpen}
        onClose={() =>
          setButtons((prevButtons) =>
            prevButtons.map((btn) =>
              btn.name === 'Arm' ? { ...btn, loading: false } : btn
            )
          )
        }
        onOpenChange={onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {logKey} is currently in an {buildingOpen} state
              </ModalHeader>
              <ModalBody>
                {buildingOpen === 'open' ? (
                  <p>
                    A door in the {logKey} is currently open, arming this
                    building will cause the alarm to go off. Are you sure you
                    wish to continue?
                  </p>
                ) : (
                  <p>
                    A door in the {logKey} is currently in an unknown state, if
                    you arm this building and the door turns out to be open
                    (once it starts responding again) it will trigger the alarm.
                    Are you sure you wish to continue?
                  </p>
                )}
              </ModalBody>
              <ModalFooter>
                <Button
                  color="primary"
                  variant="light"
                  onPress={() => {
                    onClose()
                  }}
                >
                  Go back
                </Button>
                <Button
                  color="danger"
                  onPress={() => {
                    arm(logKey, buildingOpen, true)
                    onClose()
                  }}
                >
                  Arm building
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </Card>
  )
}
