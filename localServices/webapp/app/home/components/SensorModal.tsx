'use client'

import { Modal, ModalContent, ModalHeader, ModalBody } from '@nextui-org/modal'
import { useRouter } from 'next/navigation'
import { useSocketData } from '../../socketData'
import { SensorRow } from './SensorRow'
import { SecurityData, LogStatus } from '../../types'

interface SensorModalProps {
  isOpen: boolean
  onOpenChange: () => void
  buildingName: string
  data: SecurityData
}

export function SensorModal({
  isOpen,
  onOpenChange,
  buildingName,
  data,
}: SensorModalProps) {
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
                <div className="space-y-3">
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
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  )
}
