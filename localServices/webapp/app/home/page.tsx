'use client'

import { FaCircle, FaRegCircle } from 'react-icons/fa6'
import { useSocketData } from '../socketData'
import { motion } from 'framer-motion'
import { BuildingCard } from './components/BuildingCard'
import { StatusPill } from './components/StatusPill'
import { SecurityData, DoorValues, ArmStatus } from '../types'

function countDoorEntriesBuilding(
  data: SecurityData,
  building: string
): { armed: number; disarmed: number } {
  let armedCount = 0
  let disarmedCount = 0

  const buildingData = data.logs[building]
  if (!buildingData) {
    return { armed: 0, disarmed: 0 }
  }

  for (const door in buildingData) {
    if (buildingData[door].armed) {
      armedCount++
    } else {
      disarmedCount++
    }
  }

  return { armed: armedCount, disarmed: disarmedCount }
}

function checkBuildingOpen(data: SecurityData, building: string): 'open' | 'closed' | 'unknown' {
  const buildingData = data.logs[building]
  if (!buildingData) {
    return 'unknown'
  }

  for (const door in buildingData) {
    const doorData = buildingData[door]
    if (doorData.status === 'open') {
      return 'open'
    }
    if (doorData.status === 'unknown') {
      return 'unknown'
    }
  }
  return 'closed'
}

function countDoorEntries(data: SecurityData): { armed: number; disarmed: number } {
  let armedCount = 0
  let disarmedCount = 0

  if (!data.logs) {
    return { armed: 0, disarmed: 0 }
  }

  for (const building in data.logs) {
    const buildingData = data.logs[building]
    for (const door in buildingData) {
      if (buildingData[door].armed) {
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
}): ArmStatus {
  if (armed === 0 && disarmed === 0) {
    return 'Unknown'
  } else if (armed > 0 && disarmed > 0) {
    return 'Partially armed'
  } else if (armed > 0 && disarmed === 0) {
    return 'Armed'
  } else {
    return 'Disarmed'
  }
}

export default function Index() {
  const { data, isConnected } = useSocketData()
  const armed = checkArmedState(countDoorEntries(data))

  const publicVapidKey = process.env.VAPID_PUBLIC!
  // usePushNotifications(publicVapidKey)

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 md:py-12">
      {/* Header Section - Status Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-12 space-y-4"
      >
        {/* Connection Status Pill */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <StatusPill type="connected" startContent={<FaCircle size={8} />}>
           Connected
            </StatusPill>
          ) : (
            <StatusPill type="disconnected" startContent={<FaRegCircle size={8} />}>
              Disconnected
            </StatusPill>
          )}
        </div>

        {/* System Status - Large Heading */}
        <h1 className="text-3xl md:text-4xl font-volkorn font-semibold">
          System is{' '}
          {armed === 'Armed' ? (
            <span className="text-danger-600">Armed</span>
          ) : armed === 'Disarmed' ? (
            <span className="text-success-600">Disarmed</span>
          ) : armed === 'Partially armed' ? (
            <span className="text-warning-600">Partially Armed</span>
          ) : (
            <span className="text-gray-600">Unknown</span>
          )}
        </h1>

        {/* Alarm Status */}
        <p className="text-base text-gray-600">
          Alarm is{' '}
          {data.alarm ? (
            <span className="text-danger-600 font-medium">playing</span>
          ) : (
            <span className="text-success-600 font-medium">not playing</span>
          )}
        </p>
      </motion.div>

      {/* Building Cards */}
      <div className="space-y-6">
        {data.logs &&
          Object.keys(data.logs).map((key, index) => {
            const buildingCounts = countDoorEntriesBuilding(data, key)
            const armStatus = checkArmedState(buildingCounts)
            const buildingData = data.logs[key]
            const sensorCount = buildingData ? Object.keys(buildingData).length : 0
            const openCount = buildingData
              ? Object.values(buildingData).filter(
                  (sensor: DoorValues) => sensor.status === 'open'
                ).length
              : 0
            const unknownCount = buildingData
              ? Object.values(buildingData).filter(
                  (sensor: DoorValues) => sensor.status === 'unknown'
                ).length
              : 0

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <BuildingCard
                  buildingName={key}
                  data={data}
                  armStatus={armStatus}
                  sensorCount={sensorCount}
                  armedCount={buildingCounts.armed}
                  openCount={openCount}
                  unknownCount={unknownCount}
                  buildingOpen={checkBuildingOpen(data, key)}
                />
              </motion.div>
            )
          })}
      </div>
    </div>
  )
}
