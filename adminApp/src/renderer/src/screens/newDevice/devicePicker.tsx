import { Button } from '@nextui-org/button'
import { RadioGroup, Radio } from '@nextui-org/radio'
import { useEffect, useState } from 'react'

interface USBDevice {
  vendorId: number
  productId: number
  manufacturer: string
  product: string
}

export default function DevicePicker({
  device,
  setUsb
}: {
  device: string
  setUsb: (usb: string) => void
}) {
  const [devices, setDevices] = useState<USBDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState("")

  useEffect(() => {
    // Initial fetch of USB devices
    window.api.getUSBDevices().then(setDevices)

    // Set up listener for device updates
    const handleDevicesUpdated = (_event, updatedDevices: USBDevice[]) => {
      setDevices(updatedDevices)
    }

    window.api.onUsbDevicesUpdated(handleDevicesUpdated)

    // Clean up listener on component unmount
    return () => {
      window.api.removeUsbDevicesUpdatedListener(handleDevicesUpdated)
    }
  }, [])
  return (
    <div className="w-full h-full flex flex-row justify-center gap-4">
      <div className="flex flex-col w-full justify-around">
        <div className="flex flex-col h-full">
          <h1 className="text-2xl text-center font-bold">Device Selection</h1>
          <p className="text-sm text-center text-default-400">
            please select the usb device you wish to make a new {device} from, if it is not present
            below, please disconnect and reconnect the device
          </p>
        </div>
        <div className="flex flex-row justify-center gap-4">
          <RadioGroup 
            label="Select the Usb Device" 
            orientation="horizontal"
            value={selectedDevice}
            onValueChange={setSelectedDevice}
          >
            {devices.map((device) => (
              <Radio key={`${device.vendorId}-${device.productId}`} value={`${device.vendorId}-${device.productId}`}>
                {device.manufacturer} {device.product}
              </Radio>
            ))}
          </RadioGroup>
        </div>
        <div className="flex justify-around flex-row h-full">
          <div></div>
          <Button 
            onClick={() => setUsb(selectedDevice)}
            isDisabled={!selectedDevice}
          >
            Select
          </Button>
        </div>
      </div>
    </div>
  )
}
