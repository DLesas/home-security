import { Button } from '@nextui-org/button'
import { useEffect, useState } from 'react'
import { USBDevice } from '../../../main/usb'

export default function Main() {
  const [devices, setDevices] = useState<USBDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)

  useEffect(() => {
    // Initial fetch of USB devices
    console.log('Fetching USB devices')
    console.log(window)
    window.usb.getUsbDevices().then((devices) => setDevices(devices))

    // Set up listener for device updates
    const handleDevicesUpdated = (updatedDevices: USBDevice[]) => {
      setDevices(updatedDevices)
    }

    window.usb.onDevicesChanged(handleDevicesUpdated)

    // Clean up listener on component unmount
    return () => {
      window.usb.removeDevicesChangedListener()
    }
  }, [])

  const handleSaveEnv = async () => {
    if (!selectedDevice) {
      console.error('No device selected')
      return
    }

    try {
      const envData = {
        API_KEY: 'your_api_key',
        DB_URL: 'your_db_url'
      }

      await window.usb.writeEnvFile(JSON.stringify(envData), selectedDevice)
      console.log('Env file saved successfully')
    } catch (error) {
      console.error('Failed to save env file:', error)
    }
  }

  return (
    <div>
      <h2>Select USB Device</h2>
      <select onChange={(e) => setSelectedDevice(e.target.value)}>
        <option value="">Select a device</option>
        {devices.map((device, index) => (
          <option key={index} value={device.devicePath || ''}>
            {device.manufacturer} - {device.deviceName} - {device.vendorId}:{device.productId}
          </option>
        ))}
      </select>
      <Button onClick={handleSaveEnv} disabled={!selectedDevice}>
        Save Environment Variables
      </Button>
    </div>
  )
}
