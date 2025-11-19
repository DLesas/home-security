'use client'

import { Card, CardHeader, CardBody } from '@nextui-org/card'
import { Divider } from '@nextui-org/divider'
import { useDisclosure } from '@nextui-org/modal'
import { SensorModal } from './SensorModal'
import { ArmDisarmButtons } from '../../../components/ArmDisarmButtons'
import { useArmBuildingMutation, useDisarmBuildingMutation } from '../../../hooks/mutations/useBuildingMutations'
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
  const armMutation = useArmBuildingMutation()
  const disarmMutation = useDisarmBuildingMutation()
  const { isOpen: isSensorModalOpen, onOpen: onSensorModalOpen, onOpenChange: onSensorModalOpenChange } = useDisclosure()

  return (
    <>
      {/* Building Card */}
      <Card className="w-full shadow-md hover:shadow-lg transition-shadow duration-200">
        {/* Clickable header and summary section */}
        <div
          onClick={onSensorModalOpen}
          className="cursor-pointer"
        >
          <CardHeader className="pb-2">
            <h2 className="text-xl font-volkorn font-semibold">{buildingName}</h2>
          </CardHeader>

          <CardBody className="pt-2 pb-0">
            {/* Sensor Summary */}
            <div className="flex items-center gap-2 text-sm text-default-700 flex-wrap">
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
          </CardBody>
        </div>

        <CardBody className="pt-2">
          <Divider className="mb-4" />

          {/* Action Buttons */}
          <ArmDisarmButtons
            isArmed={armStatus === 'Armed'}
            currentState={buildingOpen}
            entityName={buildingName}
            armLoading={armMutation.isPending}
            disarmLoading={disarmMutation.isPending}
            onArm={() => armMutation.mutate(buildingName)}
            onDisarm={() => disarmMutation.mutate(buildingName)}
          />
        </CardBody>
      </Card>

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
