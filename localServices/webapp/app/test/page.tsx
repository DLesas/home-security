'use client'

import React, { useEffect, useState } from 'react'
import { useSocket } from '../socketInitializer'
import { Button } from '@nextui-org/button'
import { Input } from '@nextui-org/input'
import { Select, SelectItem } from '@nextui-org/select'
import { useSocketData } from '../socketData'

// Building
// router.post("/new", async (req, res) => {
// 	const validationSchema = z.object({
// 		name: z
// 			.string({
// 				required_error: "name is required",
// 				invalid_type_error: "name must be a string",
// 			})
// 			.min(1, "name must be at least 1 character")
// 			.max(255, "name must be less than 255 characters"),
// 	});

// Sensor
// router.post("/new", async (req, res) => {
// 	const validationSchema = z.object({
// 		name: z
// 			.string({
// 				required_error: "name is required",
// 				invalid_type_error: "name must be a string",
// 			})
// 			.min(1, "name must be at least 1 character")
// 			.max(255, "name must be less than 255 characters"),
// 		building: z
// 			.string({
// 				required_error: "building is required",
// 				invalid_type_error: "building must be a string",
// 			})
// 			.min(1, "building must be at least 1 character")
// 			.max(255, "building must be less than 255 characters"),
// 		expectedSecondsUpdated: z
// 			.number({
// 				required_error: "expectedSecondsUpdated is required",
//                 invalid_type_error: "expectedSecondsUpdated must be a number",
//             })
//             .min(0, "expectedSecondsUpdated must be more than 0 seconds")
//             .max(3600 * 24, "expectedSecondsUpdated must be less than 24 hours"),
// 	});

const StorageListenerComponent: React.FC = () => {
  const [showNewSensor, setShowNewSensor] = useState(false)
  const [showNewBuilding, setShowNewBuilding] = useState(false)
  const [showNewAlarm, setShowNewAlarm] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => setShowNewSensor(!showNewSensor)}>
        new sensor
      </button>
      <button onClick={() => setShowNewBuilding(!showNewBuilding)}>
        new building
      </button>
      <button onClick={() => setShowNewAlarm(!showNewAlarm)}>new alarm</button>
      {showNewSensor && <NewSensorComponent />}
      {showNewBuilding && <NewBuildingComponent />}
      {showNewAlarm && <NewAlarmComponent />}
    </div>
  )
}

const NewSensorComponent: React.FC = () => {
  const { url } = useSocket()
  const [sensorName, setSensorName] = useState('')
  const [buildingName, setBuildingName] = useState('')
  const [expectedSecondsUpdated, setExpectedSecondsUpdated] =
    useState<number>(0)

  const makeNewSensor = () => {
    fetch(`${url}/api/v1/sensors/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Add this line
      },
      body: JSON.stringify({
        name: sensorName,
        building: buildingName,
        expectedSecondsUpdated: expectedSecondsUpdated,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log(data)
      })
  }

  return (
    <div>
      {sensorName}
      <Input
        label="Sensor Name"
        onChange={(e) => setSensorName(e.target.value)}
      />
      {buildingName}
      <Input
        label="Building Name"
        onChange={(e) => setBuildingName(e.target.value)}
      />
      {expectedSecondsUpdated}
      <Input
        label="Expected Seconds Updated"
        type="number"
        onChange={(e) => setExpectedSecondsUpdated(parseInt(e.target.value))}
      />
      <Button onClick={makeNewSensor}>Create</Button>
    </div>
  )
}

const NewBuildingComponent: React.FC = () => {
  const { url } = useSocket()
  const [buildingName, setBuildingName] = useState('')

  const makeNewBuilding = () => {
    fetch(`${url}/api/v1/buildings/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Add this line
      },
      body: JSON.stringify({ name: buildingName }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log(data)
      })
  }

  return (
    <div>
      {buildingName}
      <Input
        label="Building Name"
        onChange={(e) => setBuildingName(e.target.value)}
      />
      <Button onClick={makeNewBuilding}>Create</Button>
    </div>
  )
}

const NewAlarmComponent: React.FC = () => {
  const { url } = useSocket()
  const { data } = useSocketData()
  const [name, setName] = useState('')
  const [building, setBuilding] = useState('')
  const [expectedSecondsUpdated, setExpectedSecondsUpdated] =
    useState<number>(0)
  const [port, setPort] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Get building list from socket data logs keys
  const buildingList = data && data.logs ? Object.keys(data.logs) : []

  const makeNewAlarm = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`${url}/api/v1/alarms/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, building, expectedSecondsUpdated, port }),
      })
      const data = await res.json()
      console.log(data)
      if (!res.ok) {
        setError(data?.message || 'Failed to create alarm')
      } else {
        setSuccess('Alarm created successfully!')
        setName('')
        setBuilding('')
        setExpectedSecondsUpdated(0)
        setPort(0)
      }
    } catch (e: any) {
      setError(e.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-2 rounded-lg border p-4">
      <h3 className="mb-2 text-lg font-semibold">Create New Alarm</h3>
      <Input
        label="Alarm Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Select
        label="Building"
        placeholder="Select a building"
        selectedKeys={building ? [building] : []}
        onChange={(e) => setBuilding(e.target.value)}
        isRequired
      >
        {buildingList.map((b) => (
          <SelectItem key={b} value={b}>
            {b}
          </SelectItem>
        ))}
      </Select>
      <Input
        label="Expected Seconds Updated"
        type="number"
        value={expectedSecondsUpdated ? expectedSecondsUpdated.toString() : ''}
        onChange={(e) => setExpectedSecondsUpdated(Number(e.target.value))}
      />
      <Input
        label="Port"
        type="number"
        value={port ? port.toString() : ''}
        onChange={(e) => setPort(Number(e.target.value))}
      />
      <Button
        color="primary"
        isLoading={loading}
        onClick={makeNewAlarm}
        className="mt-2"
      >
        Create Alarm
      </Button>
      {error && <div className="mt-1 text-sm text-red-500">{error}</div>}
      {success && <div className="mt-1 text-sm text-green-500">{success}</div>}
    </div>
  )
}

export default StorageListenerComponent
