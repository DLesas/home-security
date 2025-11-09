'use client'

import { useState } from 'react'
import { Card, CardHeader, CardBody } from '@nextui-org/card'
import { Button } from '@nextui-org/button'
import { Divider } from '@nextui-org/divider'
import { useDisclosure } from '@nextui-org/modal'
import { useSocket } from '../../socketInitializer'
import { SensorModal } from './SensorModal'
import { ArmWarningModal } from './ArmWarningModal'
import { SecurityData, BuildingStatus, ArmStatus } from '../../types'

interface BuildingCardProps {
  buildingName: string
  data: SecurityData
  armStatus: ArmStatus
  sensorCount: number
  armedCount: number
  openCount: number
  unknownCount: number
  buildingOpen: BuildingStatus
}

export function BuildingCard({
  buildingName,
  data,
  armStatus,
  sensorCount,
  armedCount,
  openCount,
  unknownCount,
  buildingOpen,
}: BuildingCardProps) {
  const { url } = useSocket()
  const [armLoading, setArmLoading] = useState(false)
  const [disarmLoading, setDisarmLoading] = useState(false)
  const { isOpen: isWarningOpen, onOpen: onWarningOpen, onOpenChange: onWarningOpenChange } = useDisclosure()
  const { isOpen: isSensorModalOpen, onOpen: onSensorModalOpen, onOpenChange: onSensorModalOpenChange } = useDisclosure()

  function disarmBuilding(subject: string) {
    fetch(`${url}/api/v1/buildings/${subject}/disarm`, {
      method: 'POST',
    }).then(() => setDisarmLoading(false))
  }

  function armBuilding(
    subject: string,
    buildState: typeof buildingOpen,
    force?: boolean
  ) {
    force = force || false
    if ((buildState === 'open' || buildState === 'unknown') && !force) {
      onWarningOpen()
      return
    }
    fetch(`${url}/api/v1/buildings/${subject}/arm`, {
      method: 'POST',
    }).then(() => setArmLoading(false))
  }

  return (
    <>
      {/* Building Card */}
      <Card
        className="w-full shadow-md hover:shadow-lg transition-shadow duration-200"
        isPressable
        onPress={onSensorModalOpen}
      >
        <CardHeader className="pb-2">
          <h2 className="text-xl font-volkorn font-semibold">{buildingName}</h2>
        </CardHeader>

        <CardBody className="pt-2 space-y-4">
          {/* Sensor Summary */}
          <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
            <span>{sensorCount} {sensorCount === 1 ? 'sensor' : 'sensors'}</span>
            {armedCount > 0 && (
              <>
                <span>•</span>
                <span className="text-danger-600 font-medium">{armedCount} armed</span>
              </>
            )}
            {openCount > 0 && (
              <>
                <span>•</span>
                <span className="text-danger-600 font-medium">{openCount} open</span>
              </>
            )}
            {unknownCount > 0 && (
              <>
                <span>•</span>
                <span className="text-warning-600 font-medium">{unknownCount} unknown</span>
              </>
            )}
          </div>

          <Divider />

          {/* Action Buttons */}
          <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
            <Button
              variant={armStatus === 'Armed' ? 'solid' : 'bordered'}
              color="danger"
              className="flex-1 min-h-[44px]"
              isLoading={armLoading}
              onPress={() => {
                setArmLoading(true)
                armBuilding(buildingName, buildingOpen, false)
              }}
            >
              {armStatus === 'Armed' ? 'Armed' : 'Arm'}
            </Button>
            <Button
              variant={armStatus === 'Disarmed' ? 'solid' : 'bordered'}
              color="success"
              className="flex-1 min-h-[44px]"
              isLoading={disarmLoading}
              onPress={() => {
                setDisarmLoading(true)
                disarmBuilding(buildingName)
              }}
            >
              {armStatus === 'Disarmed' ? 'Disarmed' : 'Disarm'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Warning Modal for Building */}
      <ArmWarningModal
        isOpen={isWarningOpen}
        onOpenChange={onWarningOpenChange}
        title={`${buildingName} is currently in an ${buildingOpen} state`}
        message={
          buildingOpen === 'open'
            ? `A door in the ${buildingName} is currently open. Arming this building will cause the alarm to go off. Are you sure you wish to continue?`
            : `A door in the ${buildingName} is currently in an unknown state. If you arm this building and the door turns out to be open (once it starts responding again) it will trigger the alarm. Are you sure you wish to continue?`
        }
        onConfirm={() => {
          armBuilding(buildingName, buildingOpen, true)
        }}
        onCancel={() => setArmLoading(false)}
        confirmText="Arm building"
      />

      {/* Sensor Details Modal */}
      <SensorModal
        isOpen={isSensorModalOpen}
        onOpenChange={onSensorModalOpenChange}
        buildingName={buildingName}
        data={data}
      />
    </>
  )
}
