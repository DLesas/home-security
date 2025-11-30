'use client'

import React, { useState } from 'react'
import { useSocket } from '../socketInitializer'
import { Button } from '@nextui-org/button'
import { Input } from '@nextui-org/input'
import { Select, SelectItem } from '@nextui-org/select'
import { useBuildingsQuery } from '@/hooks/useBuildingsQuery'
import { Card, CardBody, CardHeader } from '@nextui-org/card'
import { Divider } from '@nextui-org/divider'

/**
 * DEBUG PAGE - Not accessible via navigation
 * Direct URL access only: /debug-devices
 *
 * This page allows creating sensors and alarms with custom IDs
 * for testing and debugging purposes.
 */

const DebugDevicesPage: React.FC = () => {
  return (
    <div className="container mx-auto max-w-6xl p-4">
      <h1 className="mb-6 text-3xl font-bold">Debug Device Creation</h1>
      <p className="mb-8 text-sm text-gray-600 dark:text-gray-400">
        This page is for debugging only. Create sensors and alarms with custom IDs.
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <DebugSensorForm />
        <DebugAlarmForm />
      </div>
    </div>
  )
}

const DebugSensorForm: React.FC = () => {
  const { url } = useSocket()
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [building, setBuilding] = useState('')
  const [expectedSecondsUpdated, setExpectedSecondsUpdated] = useState<number>(60)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [responseData, setResponseData] = useState<any>(null)

  const createDebugSensor = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    setResponseData(null)

    try {
      const res = await fetch(`${url}/api/v1/debug/sensors/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          name,
          building,
          expectedSecondsUpdated,
        }),
      })

      const data = await res.json()
      setResponseData(data)

      if (!res.ok) {
        // Handle different error codes
        if (res.status === 409) {
          setError(`Duplicate ID: A sensor with ID "${id}" already exists`)
        } else if (res.status === 404) {
          setError('Building not found. Please create the building first.')
        } else {
          setError(data?.message || `Failed to create sensor (${res.status})`)
        }
      } else {
        setSuccess(`Sensor created successfully with ID: ${id}`)
        // Reset form
        setId('')
        setName('')
        setBuilding('')
        setExpectedSecondsUpdated(60)
      }
    } catch (e: any) {
      setError(e.message || 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Create Debug Sensor</h2>
      </CardHeader>
      <Divider />
      <CardBody>
        <div className="flex flex-col gap-4">
          <Input
            label="Custom ID"
            placeholder="e.g., sensor_debug_001"
            value={id}
            onChange={(e) => setId(e.target.value)}
            isRequired
            description="Unique identifier for this sensor"
          />
          <Input
            label="Sensor Name"
            placeholder="e.g., Test Door Sensor"
            value={name}
            onChange={(e) => setName(e.target.value)}
            isRequired
          />
          <Input
            label="Building Name"
            placeholder="e.g., Main Building"
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            isRequired
            description="Building must already exist in the system"
          />
          <Input
            label="Expected Update Interval (seconds)"
            type="number"
            value={expectedSecondsUpdated.toString()}
            onChange={(e) => setExpectedSecondsUpdated(Number(e.target.value))}
            isRequired
            description="How often the sensor should send updates (0-86400)"
          />

          <Button
            color="primary"
            isLoading={loading}
            onClick={createDebugSensor}
            isDisabled={!id || !name || !building}
            className="mt-2"
          >
            Create Sensor
          </Button>

          {error && (
            <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-green-100 p-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {success}
            </div>
          )}
          {responseData && (
            <div>
              <p className="mb-2 text-sm font-medium">Response:</p>
              <pre className="overflow-auto rounded-lg bg-gray-100 p-3 text-xs dark:bg-gray-800">
                {JSON.stringify(responseData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

const DebugAlarmForm: React.FC = () => {
  const { url } = useSocket()
  const { data: buildings, isLoading: isLoadingBuildings } = useBuildingsQuery()
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [building, setBuilding] = useState('')
  const [expectedSecondsUpdated, setExpectedSecondsUpdated] = useState<number>(60)
  const [port, setPort] = useState<number>(8080)
  const [autoTurnOffSeconds, setAutoTurnOffSeconds] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [responseData, setResponseData] = useState<any>(null)

  const buildingList = buildings ? buildings.map((b) => b.name) : []

  const createDebugAlarm = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    setResponseData(null)

    try {
      const res = await fetch(`${url}/api/v1/debug/alarms/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          name,
          building,
          expectedSecondsUpdated,
          port,
          autoTurnOffSeconds,
        }),
      })

      const data = await res.json()
      setResponseData(data)

      if (!res.ok) {
        // Handle different error codes
        if (res.status === 409) {
          setError(`Duplicate ID: An alarm with ID "${id}" already exists`)
        } else if (res.status === 404) {
          setError('Building not found. Please create the building first.')
        } else {
          setError(data?.message || `Failed to create alarm (${res.status})`)
        }
      } else {
        setSuccess(`Alarm created successfully with ID: ${id}`)
        // Reset form
        setId('')
        setName('')
        setBuilding('')
        setExpectedSecondsUpdated(60)
        setPort(8080)
        setAutoTurnOffSeconds(0)
      }
    } catch (e: any) {
      setError(e.message || 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Create Debug Alarm</h2>
      </CardHeader>
      <Divider />
      <CardBody>
        <div className="flex flex-col gap-4">
          <Input
            label="Custom ID"
            placeholder="e.g., alarm_debug_001"
            value={id}
            onChange={(e) => setId(e.target.value)}
            isRequired
            description="Unique identifier for this alarm"
          />
          <Input
            label="Alarm Name"
            placeholder="e.g., Test Alarm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            isRequired
          />
          <Select
            label="Building"
            placeholder="Select a building"
            selectedKeys={building ? [building] : []}
            onChange={(e) => setBuilding(e.target.value)}
            isRequired
            isLoading={isLoadingBuildings}
            description="Select from existing buildings"
          >
            {buildingList.map((b) => (
              <SelectItem key={b!} value={b || ''}>
                {b}
              </SelectItem>
            ))}
          </Select>
          <Input
            label="Expected Update Interval (seconds)"
            type="number"
            value={expectedSecondsUpdated.toString()}
            onChange={(e) => setExpectedSecondsUpdated(Number(e.target.value))}
            isRequired
            description="How often the alarm should send updates (0-86400)"
          />
          <Input
            label="Port"
            type="number"
            value={port.toString()}
            onChange={(e) => setPort(Number(e.target.value))}
            isRequired
            description="Port number for the alarm (1-65535)"
          />
          <Input
            label="Auto Turn Off (seconds)"
            type="number"
            value={autoTurnOffSeconds.toString()}
            onChange={(e) => setAutoTurnOffSeconds(Number(e.target.value))}
            description="Auto turn-off timeout (0 = disabled, max 86400)"
          />

          <Button
            color="primary"
            isLoading={loading}
            onClick={createDebugAlarm}
            isDisabled={!id || !name || !building}
            className="mt-2"
          >
            Create Alarm
          </Button>

          {error && (
            <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-green-100 p-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {success}
            </div>
          )}
          {responseData && (
            <div>
              <p className="mb-2 text-sm font-medium">Response:</p>
              <pre className="overflow-auto rounded-lg bg-gray-100 p-3 text-xs dark:bg-gray-800">
                {JSON.stringify(responseData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

export default DebugDevicesPage
