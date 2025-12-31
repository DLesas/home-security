'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardBody } from '@nextui-org/card'
import { Button } from '@nextui-org/button'
import { useSocketData } from '../socketData'
import { useSensorOrder } from '../../hooks/useSensorOrder'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { MdDragIndicator, MdSave, MdRefresh, MdAdd, MdVideocam, MdDelete } from 'react-icons/md'
import { AddCameraModal } from '../cameras/components/AddCameraModal'
import { useDeleteCameraMutation } from '@/hooks/mutations/useCameraMutations'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { sensors, cameras } = useSocketData()
  const [isAddCameraOpen, setIsAddCameraOpen] = useState(false)
  const deleteCamera = useDeleteCameraMutation()

  const handleDeleteCamera = async (cameraId: string, cameraName: string) => {
    if (!confirm(`Delete "${cameraName}"? This cannot be undone.`)) return

    try {
      await deleteCamera.mutateAsync(cameraId)
      toast.success(`Camera "${cameraName}" deleted`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete camera')
    }
  }

  const {
    sensorOrder,
    hasChanges,
    saveSensorOrder,
    updateSensorOrder,
    getBuildingOrder,
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

    const { source, destination, type } = result

    if (type === 'BUILDING') {
      // Handle building reordering
      const newBuildingOrder = [...sensorOrder.buildingOrder]
      const [reorderedBuilding] = newBuildingOrder.splice(source.index, 1)
      newBuildingOrder.splice(destination.index, 0, reorderedBuilding)

      const newOrder = {
        ...sensorOrder,
        buildingOrder: newBuildingOrder,
      }
      updateSensorOrder(newOrder)
    } else {
      // Handle sensor reordering within a building
      const building = source.droppableId
      const newSensorsInBuildings = { ...sensorOrder.sensorsInBuildings }
      const [reorderedItem] = newSensorsInBuildings[building].splice(
        source.index,
        1
      )
      newSensorsInBuildings[building].splice(
        destination.index,
        0,
        reorderedItem
      )

      const newOrder = {
        ...sensorOrder,
        sensorsInBuildings: newSensorsInBuildings,
      }
      updateSensorOrder(newOrder)
    }
  }

  const handleSave = () => {
    saveSensorOrder(sensorOrder)
  }

  const resetToDefault = () => {
    initializeSensorOrder(sensors)
  }

  const buildings = getBuildingOrder()

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600">Manage cameras and configure display order</p>
        </div>

        {/* Cameras Section */}
        <Card className="w-full">
          <CardHeader>
            <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Cameras</h2>
                <p className="text-sm text-gray-600">
                  {cameras.length} camera{cameras.length !== 1 ? 's' : ''} configured
                </p>
              </div>
              <Button
                startContent={<MdAdd />}
                color="primary"
                onPress={() => setIsAddCameraOpen(true)}
              >
                Add Camera
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            {cameras.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <MdVideocam className="mx-auto mb-2 text-4xl" />
                <p>No cameras configured</p>
                <p className="text-sm">Add a camera to get started</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {cameras.map((camera) => (
                  <Card key={camera.externalID} className="shadow-sm">
                    <CardBody className="flex flex-row items-center gap-3 p-3">
                      <MdVideocam className="text-2xl text-gray-400" />
                      <div className="flex-1">
                        <p className="font-medium">{camera.name}</p>
                        <p className="text-sm text-gray-500">{camera.building}</p>
                      </div>
                      <div
                        className={`rounded px-2 py-1 text-xs ${
                          camera.motionDetectionEnabled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {camera.motionDetectionEnabled ? 'Motion On' : 'Motion Off'}
                      </div>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        isLoading={deleteCamera.isPending}
                        onPress={() => handleDeleteCamera(camera.externalID, camera.name)}
                      >
                        <MdDelete className="text-lg" />
                      </Button>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Sensor Order Section */}
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
              <Droppable droppableId="buildings" type="BUILDING">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="flex flex-col gap-6"
                  >
                    {buildings.map((building, buildingIndex) => (
                      <Draggable
                        key={building}
                        draggableId={building}
                        index={buildingIndex}
                      >
                        {(buildingProvided, buildingSnapshot) => (
                          <div
                            ref={buildingProvided.innerRef}
                            {...buildingProvided.draggableProps}
                            className={`rounded-lg border p-4 ${
                              buildingSnapshot.isDragging
                                ? 'border-primary shadow-lg'
                                : 'border-gray-200'
                            }`}
                          >
                            <div className="mb-4 flex items-center gap-3">
                              <div
                                {...buildingProvided.dragHandleProps}
                                className="cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing"
                              >
                                <MdDragIndicator size={20} />
                              </div>
                              <h3 className="text-lg font-medium">
                                {building}
                              </h3>
                            </div>
                            <Droppable droppableId={building} type="SENSOR">
                              {(sensorProvided, sensorSnapshot) => (
                                <div
                                  {...sensorProvided.droppableProps}
                                  ref={sensorProvided.innerRef}
                                  className={`min-h-[100px] rounded-lg border-2 border-dashed p-4 ${
                                    sensorSnapshot.isDraggingOver
                                      ? 'border-primary bg-primary/10'
                                      : 'border-gray-300'
                                  }`}
                                >
                                  {sensorOrder.sensorsInBuildings[
                                    building
                                  ]?.map((sensorName, index) => {
                                    const sensor = sensors.find(
                                      (s) =>
                                        s.name === sensorName &&
                                        s.building === building
                                    )
                                    if (!sensor) return null

                                    return (
                                      <Draggable
                                        key={`${building}-${sensorName}`}
                                        draggableId={`${building}-${sensorName}`}
                                        index={index}
                                      >
                                        {(
                                          sensorItemProvided,
                                          sensorItemSnapshot
                                        ) => (
                                          <div
                                            ref={sensorItemProvided.innerRef}
                                            {...sensorItemProvided.draggableProps}
                                            className={`mb-2 last:mb-0 ${
                                              sensorItemSnapshot.isDragging
                                                ? 'z-50'
                                                : ''
                                            }`}
                                          >
                                            <Card
                                              className={`transition-shadow ${
                                                sensorItemSnapshot.isDragging
                                                  ? 'shadow-lg'
                                                  : 'shadow-sm hover:shadow-md'
                                              }`}
                                            >
                                              <CardBody className="flex flex-row items-center gap-3 p-3">
                                                <div
                                                  {...sensorItemProvided.dragHandleProps}
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
                                                      : sensor.state ===
                                                          'closed'
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
                                  {sensorProvided.placeholder}
                                  {(!sensorOrder.sensorsInBuildings[building] ||
                                    sensorOrder.sensorsInBuildings[building]
                                      .length === 0) && (
                                    <div className="py-8 text-center text-gray-500">
                                      No sensors in this building
                                    </div>
                                  )}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {buildings.length === 0 && (
                      <div className="py-8 text-center text-gray-500">
                        No sensors available
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </CardBody>
        </Card>
      </div>

      <AddCameraModal
        isOpen={isAddCameraOpen}
        onClose={() => setIsAddCameraOpen(false)}
      />
    </div>
  )
}
