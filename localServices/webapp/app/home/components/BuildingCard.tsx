'use client'

import { Card, CardHeader, CardBody } from '@nextui-org/card'
import { Divider } from '@nextui-org/divider'
import { useDisclosure } from '@nextui-org/modal'
import { SensorModal } from './SensorModal'
import { StatusPill } from './StatusPill'
import { ArmDisarmButtons } from '../../../components/ArmDisarmButtons'
import { useArmBuildingMutation, useDisarmBuildingMutation } from '../../../hooks/mutations/useBuildingMutations'
import { SecurityData, BuildingStatus, ArmStatus } from '../../types'
import { type Alarm } from '../../socketData'

interface BuildingCardProps {
  buildingName: string
  data: SecurityData
  armStatus: ArmStatus
  sensorCount: number
  armedCount: number
  openCount: number
  unknownCount: number
  buildingOpen: BuildingStatus
  alarms: Alarm[]
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
  alarms,
}: BuildingCardProps) {
  const armMutation = useArmBuildingMutation()
  const disarmMutation = useDisarmBuildingMutation()
  const { isOpen: isSensorModalOpen, onOpen: onSensorModalOpen, onOpenChange: onSensorModalOpenChange } = useDisclosure()

  // Calculate closed sensors count
  const closedCount = sensorCount - openCount - unknownCount

  // Alarm count
  const alarmCount = alarms.length

  return (
    <>
      {/* Building Card */}
      <Card className="w-full shadow-md hover:shadow-lg transition-shadow duration-200">
        {/* Clickable header and summary section */}
        <div
          onClick={onSensorModalOpen}
          className="cursor-pointer"
        >
          <CardHeader className="pb-2 flex justify-between items-center">
            <h2 className="text-xl font-volkorn font-semibold">{buildingName}</h2>
            {armedCount > 0 && <StatusPill type="armed">{armedCount} armed</StatusPill>}
          </CardHeader>

          <CardBody className="pt-2 pb-0">
            {/* Sensor Summary */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-default-700">{sensorCount} {sensorCount === 1 ? 'sensor' : 'sensors'}</span>
                {alarmCount > 0 && (
                  <>
                    <span className="text-sm text-default-700">•</span>
                    <span className="text-sm text-default-700">{alarmCount} {alarmCount === 1 ? 'alarm' : 'alarms'}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {openCount > 0 && <StatusPill type="open">{openCount} open</StatusPill>}
                {closedCount > 0 && <StatusPill type="closed">{closedCount} closed</StatusPill>}
                {unknownCount > 0 && <StatusPill type="unknown">{unknownCount} unknown</StatusPill>}
              </div>
            </div>
          </CardBody>
        </div>

        <CardBody className="pt-2">
          <Divider className="mb-4" />

          {/* Action Buttons */}
          <ArmDisarmButtons
            isArmed={armStatus === 'Armed'}
            isPartiallyArmed={armStatus === 'Partially armed'}
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
        alarms={alarms}
      />
    </>
  )
}
