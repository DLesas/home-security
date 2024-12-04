import { Button } from '@nextui-org/button'
import { useEffect, useState } from 'react'

interface USBDevice {
  vendorId: number
  productId: number
  manufacturer: string
  product: string
}

export default function Main() {
  const [devices, setDevices] = useState<USBDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)

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

  const handleSaveEnv = () => {
    if (!selectedDevice) {
      console.error('No device selected')
      return
    }

    const envData = {
      API_KEY: 'your_api_key',
      DB_URL: 'your_db_url'
    }

    window.api.saveEnv(envData, selectedDevice)
  }

  useEffect(() => {
    const handleSaveResult = (result) => {
      if (result.success) {
        console.log('Env file saved successfully')
      } else {
        console.error('Failed to save env file:', result.error)
      }
    }

    window.api.onSaveEnvResult(handleSaveResult)

    return () => {
      // Clean up the listener when the component unmounts
      window.api.onSaveEnvResult(null)
    }
  }, [])

  return (
    <div>
      <h2>Select USB Device</h2>
      <select onChange={(e) => setSelectedDevice(e.target.value)}>
        <option value="">Select a device</option>
        {devices.map((device, index) => (
          <option key={index} value={`/dev/usb/${device.vendorId}/${device.productId}`}>
            {device.manufacturer} - {device.product} - {device.vendorId}:{device.productId}
          </option>
        ))}
      </select>
      <Button onClick={handleSaveEnv} disabled={!selectedDevice}>
        Save Environment Variables
      </Button>
    </div>
  )
}
