'use client'

import { Modal, ModalContent, ModalHeader, ModalBody } from '@nextui-org/modal'
import { Divider } from '@nextui-org/divider'
import { useRouter } from 'next/navigation'
import { useSocketData, type Alarm, type Camera } from '../../socketData'
import { SensorRow } from './SensorRow'
import { AlarmRow } from './AlarmRow'
import { CameraFeedGrid } from './CameraFeedGrid'
import { SecurityData, LogStatus } from '../../types'

interface BuildingOverviewModalProps {
  isOpen: boolean
  onOpenChange: () => void
  buildingName: string
  data: SecurityData
  alarms: Alarm[]
  cameras: Camera[]
}

export function BuildingOverviewModal({
  isOpen,
  onOpenChange,
  buildingName,
  data,
  alarms,
  cameras,
}: BuildingOverviewModalProps) {
  const router = useRouter()
  const { sensors } = useSocketData()

  function handleSensorClick(sensorName: string) {
    const sensor = sensors.find(
      (s) => s.name === sensorName && s.building === buildingName
    )
    if (sensor) {
      router.push(`/sensors/${sensor.externalID}`)
    }
  }

  function handleAlarmClick(alarmExternalID: string) {
    router.push(`/alarms/${alarmExternalID}`)
  }

  function handleCameraClick(cameraExternalID: string) {
    router.push(`/cameras/${cameraExternalID}`)
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        placement="bottom"
        scrollBehavior="inside"
        classNames={{
          wrapper: "items-end",
          base: "m-0 sm:m-0 rounded-t-lg w-full max-w-full max-h-[80vh]",
          body: "py-6 background-default-900",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                <h3 className="font-volkorn text-xl">{buildingName}</h3>
              </ModalHeader>
              <ModalBody>
                {/* Cameras Section */}
                <CameraFeedGrid
                  cameras={cameras}
                  onCameraClick={(cameraId) => {
                    handleCameraClick(cameraId)
                    onClose()
                  }}
                />

                <div className="space-y-3">
                  {/* Sensors Section */}
                  {data.logs[buildingName] &&
                    Object.keys(data.logs[buildingName]).map((sensorName: string, index: number) => {
                      const buildingData = data.logs[buildingName]
                      const sensorData = buildingData[sensorName]
                      const sensorArmed = sensorData?.armed ?? false
                      const sensorStatus: LogStatus = sensorData?.status ?? 'unknown'

                      // Find sensor to get externalID
                      const sensor = sensors.find(s => s.name === sensorName && s.building === buildingName)

                      return (
                        <SensorRow
                          key={sensorName}
                          sensorName={sensorName}
                          sensorExternalID={sensor?.externalID || ''}
                          sensorArmed={sensorArmed}
                          sensorStatus={sensorStatus}
                          index={index}
                          onSensorClick={() => {
                            handleSensorClick(sensorName)
                            onClose()
                          }}
                        />
                      )
                    })}

                  {/* Divider between sensors and alarms */}
                  {data.logs[buildingName] && Object.keys(data.logs[buildingName]).length > 0 && alarms.length > 0 && (
                    <div className="py-4" />
                  )}

                  {/* Alarms Section */}
                  {alarms.length > 0 && (
                    <AlarmRow
                      alarms={alarms}
                      index={Object.keys(data.logs[buildingName] || {}).length}
                      onAlarmClick={(alarmId) => {
                        handleAlarmClick(alarmId)
                        onClose()
                      }}
                    />
                  )}
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  )
}
