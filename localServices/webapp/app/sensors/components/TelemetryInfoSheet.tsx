'use client'

import { Modal, ModalContent, ModalHeader, ModalBody } from '@nextui-org/modal'
import { IoThermometer, IoRadio } from 'react-icons/io5'
import { MdElectricBolt, MdAccessTime } from 'react-icons/md'

interface TelemetryInfoSheetProps {
  isOpen: boolean
  onOpenChange: () => void
}

export function TelemetryInfoSheet({ isOpen, onOpenChange }: TelemetryInfoSheetProps) {
  const metrics = [
    {
      icon: <IoThermometer className="text-lg" />,
      label: 'Temperature',
      description: 'Current temperature reading from the sensor in degrees Celsius. Helps monitor environmental conditions and detect potential hardware issues.',
    },
    {
      icon: <MdElectricBolt className="text-lg" />,
      label: 'Voltage',
      description: 'Battery voltage level. Monitor this to know when batteries need replacement. Normal range is typically 2.8V - 3.3V.',
    },
    {
      icon: <IoRadio className="text-lg" />,
      label: 'Frequency',
      description: 'The operating frequency of the microcontroller core in MHz. This indicates the processing speed of the sensor.',
    },
    {
      icon: <MdAccessTime className="text-lg" />,
      label: 'Ping Interval',
      description: 'How often the sensor sends status updates to the server in seconds. Shorter intervals provide more frequent updates but use more battery.',
    },
  ]

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="bottom"
      scrollBehavior="inside"
      classNames={{
        wrapper: "items-end",
        base: "m-0 sm:m-0 rounded-t-lg w-full max-w-full max-h-[80vh]",
        body: "py-6",
      }}
    >
      <ModalContent>
        <ModalHeader>
          <h3 className="font-volkorn text-xl">Telemetry Information</h3>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {metrics.map((metric, index) => (
              <div key={index} className="flex gap-3">
                <div className="text-default-500 mt-1">
                  {metric.icon}
                </div>
                <div>
                  <h4 className="font-semibold mb-1">{metric.label}</h4>
                  <p className="text-sm text-default-600">{metric.description}</p>
                </div>
              </div>
            ))}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
