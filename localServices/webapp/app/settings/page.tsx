'use client'

import { useEffect } from 'react'
import { Card, CardHeader, CardBody } from '@nextui-org/card'
import { Button } from '@nextui-org/button'
import { useSocketData } from '../socketData'
import { useSensorOrder } from '../../hooks/useSensorOrder'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { MdDragIndicator, MdSave, MdRefresh } from 'react-icons/md'

export default function SettingsPage() {
  const { sensors } = useSocketData()
  const {
    sensorOrder,
    hasChanges,
    saveSensorOrder,
    updateSensorOrder,
    syncSensorOrder,
    initializeSensorOrder,
  } = useSensorOrder()

  // Sync sensor order when sensors change (handles first-time, additions, removals)
  useEffect(() => {
    if (sensors.length > 0) {
      syncSensorOrder(sensors)
    }
  }, [sensors, syncSensorOrder])

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const { source, destination } = result
    const building = source.droppableId

    const newOrder = { ...sensorOrder }
    const [reorderedItem] = newOrder[building].splice(source.index, 1)
    newOrder[building].splice(destination.index, 0, reorderedItem)

    updateSensorOrder(newOrder)
  }

  const handleSave = () => {
    saveSensorOrder(sensorOrder)
  }

  const resetToDefault = () => {
    initializeSensorOrder(sensors)
  }

  const buildings = Object.keys(sensorOrder)

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600">Configure your sensor display order</p>
        </div>

        <Card className="w-full">
          <CardHeader>
            <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Sensor Order</h2>
                <p className="text-sm text-gray-600">
                  Drag and drop to reorder sensors within each building
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  startContent={<MdRefresh />}
                  variant="ghost"
                  onPress={resetToDefault}
                >
                  Reset
                </Button>
                <Button
                  startContent={<MdSave />}
                  color="primary"
                  isDisabled={!hasChanges}
                  onPress={handleSave}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="flex flex-col gap-6">
                {buildings.map((building) => (
                  <div key={building} className="rounded-lg border p-4">
                    <h3 className="mb-4 text-lg font-medium">{building}</h3>
                    <Droppable droppableId={building}>
                      {(provided, snapshot) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className={`min-h-[100px] rounded-lg border-2 border-dashed p-4 ${
                            snapshot.isDraggingOver
                              ? 'border-primary bg-primary/10'
                              : 'border-gray-300'
                          }`}
                        >
                          {sensorOrder[building]?.map((sensorName, index) => {
                            const sensor = sensors.find(
                              (s) =>
                                s.name === sensorName && s.building === building
                            )
                            if (!sensor) return null

                            return (
                              <Draggable
                                key={`${building}-${sensorName}`}
                                draggableId={`${building}-${sensorName}`}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`mb-2 last:mb-0 ${
                                      snapshot.isDragging ? 'z-50' : ''
                                    }`}
                                  >
                                    <Card
                                      className={`transition-shadow ${
                                        snapshot.isDragging
                                          ? 'shadow-lg'
                                          : 'shadow-sm hover:shadow-md'
                                      }`}
                                    >
                                      <CardBody className="flex flex-row items-center gap-3 p-3">
                                        <div
                                          {...provided.dragHandleProps}
                                          className="cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing"
                                        >
                                          <MdDragIndicator size={20} />
                                        </div>
                                        <div className="flex-1">
                                          <p className="font-medium">
                                            {sensor.name}
                                          </p>
                                          <p className="text-sm text-gray-500">
                                            Status: {sensor.state} |
                                            {sensor.armed
                                              ? ' Armed'
                                              : ' Disarmed'}
                                          </p>
                                        </div>
                                        <div
                                          className={`rounded px-2 py-1 text-xs ${
                                            sensor.state === 'open'
                                              ? 'bg-red-100 text-red-700'
                                              : sensor.state === 'closed'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-700'
                                          }`}
                                        >
                                          {sensor.state}
                                        </div>
                                      </CardBody>
                                    </Card>
                                  </div>
                                )}
                              </Draggable>
                            )
                          })}
                          {provided.placeholder}
                          {(!sensorOrder[building] ||
                            sensorOrder[building].length === 0) && (
                            <div className="py-8 text-center text-gray-500">
                              No sensors in this building
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
                {buildings.length === 0 && (
                  <div className="py-8 text-center text-gray-500">
                    No sensors available
                  </div>
                )}
              </div>
            </DragDropContext>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
