'use client'

import { useState } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, useDisclosure } from '@nextui-org/modal'
import { useRouter } from 'next/navigation'
import { useSocket } from '../../socketInitializer'
import { useSocketData } from '../../socketData'
import { ArmWarningModal } from './ArmWarningModal'
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
  const { url } = useSocket()
  const { sensors } = useSocketData()
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null)
  const [sensorLoadingStates, setSensorLoadingStates] = useState<{[key: string]: {arm: boolean, disarm: boolean}}>({})
  const { isOpen: isWarningOpen, onOpen: onWarningOpen, onOpenChange: onWarningOpenChange } = useDisclosure()

  function handleSensorClick(sensorName: string) {
    const sensor = sensors.find(
      (s) => s.name === sensorName && s.building === buildingName
    )
    if (sensor) {
      router.push(`/sensors/${sensor.externalID}`)
    }
  }

  function armSensor(sensorName: string, sensorStatus: LogStatus, force?: boolean) {
    force = force || false
    if ((sensorStatus === 'open' || sensorStatus === 'unknown') && !force) {
      setSelectedSensor(sensorName)
      onWarningOpen()
      return
    }

    const sensor = sensors.find(s => s.name === sensorName && s.building === buildingName)
    if (!sensor) return

    setSensorLoadingStates(prev => ({...prev, [sensorName]: {...prev[sensorName], arm: true}}))
    fetch(`${url}/api/v1/sensors/${sensor.externalID}/arm`, {
      method: 'POST',
    }).then(() => {
      setSensorLoadingStates(prev => ({...prev, [sensorName]: {...prev[sensorName], arm: false}}))
    })
  }

  function disarmSensor(sensorName: string) {
    const sensor = sensors.find(s => s.name === sensorName && s.building === buildingName)
    if (!sensor) return

    setSensorLoadingStates(prev => ({...prev, [sensorName]: {...prev[sensorName], disarm: true}}))
    fetch(`${url}/api/v1/sensors/${sensor.externalID}/disarm`, {
      method: 'POST',
    }).then(() => {
      setSensorLoadingStates(prev => ({...prev, [sensorName]: {...prev[sensorName], disarm: false}}))
    })
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
                          armLoading={sensorLoadingStates[sensorName]?.arm}
                          disarmLoading={sensorLoadingStates[sensorName]?.disarm}
                          onSensorClick={() => {
                            handleSensorClick(sensorName)
                            onClose()
                          }}
                          onArm={() => armSensor(sensorName, sensorStatus, false)}
                          onDisarm={() => disarmSensor(sensorName)}
                        />
                      )
                    })}
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Warning Modal for Individual Sensor */}
      {selectedSensor && (() => {
        const buildingData = data.logs[buildingName]
        const sensorData = buildingData?.[selectedSensor]
        const sensorStatus: LogStatus = sensorData?.status ?? 'unknown'

        return (
          <ArmWarningModal
            isOpen={isWarningOpen}
            onOpenChange={onWarningOpenChange}
            title={`${selectedSensor} is currently in an ${sensorStatus} state`}
            message={
              sensorStatus === 'open'
                ? `The ${selectedSensor} sensor is currently open. Arming this sensor will cause the alarm to go off. Are you sure you wish to continue?`
                : `The ${selectedSensor} sensor is currently in an unknown state. If you arm this sensor and it turns out to be open (once it starts responding again) it will trigger the alarm. Are you sure you wish to continue?`
            }
            onConfirm={() => {
              armSensor(selectedSensor, sensorStatus, true)
            }}
            onCancel={() => {
              if (selectedSensor) {
                setSensorLoadingStates(prev => ({...prev, [selectedSensor]: {...prev[selectedSensor], arm: false}}))
              }
            }}
            confirmText="Arm sensor"
          />
        )
      })()}
    </>
  )
}
