'use client'
import React from 'react'
import { useSocketData } from '../socketData'
import { Button } from '@nextui-org/button'
import { Card, CardBody, CardHeader } from '@nextui-org/card'
import { FaTrash } from 'react-icons/fa'
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@nextui-org/table'

const AllDevicesPage = () => {
  const { sensors, alarms } = useSocketData()

  const handleRemoveSensor = async (sensorId: string) => {
    try {
      const response = await fetch(`/api/v1/sensors/${sensorId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete sensor')
      }
      // Optionally, you can refetch or have the socket update the data
      console.log(`Sensor ${sensorId} deleted`)
    } catch (error) {
      console.error('Error deleting sensor:', error)
    }
  }

  const handleRemoveAlarm = async (alarmId: string) => {
    try {
      const response = await fetch(`/api/v1/alarms/${alarmId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete alarm')
      }
      // Optionally, you can refetch or have the socket update the data
      console.log(`Alarm ${alarmId} deleted`)
    } catch (error) {
      console.error('Error deleting alarm:', error)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-4 text-2xl font-bold">All Devices</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Sensors</h2>
          </CardHeader>
          <CardBody>
            <Table aria-label="Sensors">
              <TableHeader>
                <TableColumn>NAME</TableColumn>
                <TableColumn>ID</TableColumn>
                <TableColumn>BUILDING</TableColumn>
                <TableColumn>STATE</TableColumn>
                <TableColumn>ARMED</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {sensors.map((sensor) => (
                  <TableRow key={sensor.externalID}>
                    <TableCell>{sensor.name}</TableCell>
                    <TableCell>{sensor.externalID}</TableCell>
                    <TableCell>{sensor.building}</TableCell>
                    <TableCell>{sensor.state}</TableCell>
                    <TableCell>{sensor.armed ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <Button
                        isIconOnly
                        color="danger"
                        aria-label="Delete sensor"
                        onClick={() => handleRemoveSensor(sensor.externalID)}
                      >
                        <FaTrash />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Alarms</h2>
          </CardHeader>
          <CardBody>
            <Table aria-label="Alarms">
              <TableHeader>
                <TableColumn>NAME</TableColumn>
                <TableColumn>ID</TableColumn>
                <TableColumn>BUILDING</TableColumn>
                <TableColumn>PLAYING</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {alarms.map((alarm) => (
                  <TableRow key={alarm.externalID}>
                    <TableCell>{alarm.name}</TableCell>
                    <TableCell>{alarm.externalID}</TableCell>
                    <TableCell>{alarm.building}</TableCell>
                    <TableCell>{alarm.playing ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <Button
                        isIconOnly
                        color="danger"
                        aria-label="Delete alarm"
                        onClick={() => handleRemoveAlarm(alarm.externalID)}
                      >
                        <FaTrash />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

export default AllDevicesPage
