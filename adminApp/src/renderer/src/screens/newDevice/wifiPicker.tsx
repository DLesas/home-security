import { Button } from '@nextui-org/button'
import { useEffect, useState } from 'react'
import { Select, SelectItem } from "@nextui-org/select"
import { Input } from "@nextui-org/input"

interface WiFiNetwork {
  isConnected: boolean
  ssid: string
  quality: number
  security: string
  frequency: number
  signal_level: number
}

export default function WifiPicker({
  device,
  setWifi
}: {
  device: string
  setWifi: (wifi: string, wifipassword: string) => void
}) {
  const [networks, setNetworks] = useState<WiFiNetwork[]>([])
  const [selectedNetwork, setSelectedNetwork] = useState("")
  const [wifiPassword, setWifiPassword] = useState("")
  console.log(networks)

  useEffect(() => {
    // Get initial networks
    window.api.getWifiNetworks().then((initialNetworks) => {
      console.log('Initial networks:', initialNetworks)
      setNetworks(initialNetworks)
    }).catch(error => {
      console.error('Error getting networks:', error)
    })

    // Set up listener for network updates
    const handleNetworksChanged = (_event: Electron.IpcRendererEvent, updatedNetworks: WiFiNetwork[]) => {
      console.log('Networks updated:', updatedNetworks)
      setNetworks(updatedNetworks)
    }

    window.api.onWifiNetworksChanged(handleNetworksChanged)

    // Clean up listener on component unmount
    return () => {
      window.api.removeWifiNetworksChangedListener(handleNetworksChanged)
    }
  }, [])

  const getSignalStrength = (quality: number) => {
    return Math.min(Math.max(Math.round(quality), 0), 100)
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8">
        {/* Header Section */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">WiFi Selection</h1>
          <p className="mt-2 text-sm text-default-400">
            Please select the WiFi network you wish to connect your {device} to.
          </p>
        </div>

        {/* Form Section */}
        <div className="space-y-6">
          <Select
            items={networks}
            label="Select WiFi Network"
            placeholder="Choose a network"
            labelPlacement="outside"
            classNames={{
              base: "w-full",
              trigger: "h-12"
            }}
            selectedKeys={selectedNetwork ? [selectedNetwork] : []}
            onSelectionChange={(keys) => setSelectedNetwork(Array.from(keys)[0] as string)}
            renderValue={(items) => {
              return items.map(item => (
                <div key={item.key} className="flex flex-col gap-1">
                  <span>{item.data?.ssid} {item.data?.isConnected && "(Connected)"}</span>
                  <span className="text-tiny text-default-400">
                    Signal: {getSignalStrength(item.data?.quality ?? 0)}% - {item.data?.security}
                  </span>
                </div>
              ))
            }}
          >
            {(network: WiFiNetwork) => (
              <SelectItem key={network.ssid} textValue={network.ssid}>
                <div className="flex flex-col gap-1">
                  <span>
                    {network.ssid} {network.isConnected && "(Connected)"}
                  </span>
                  <span className="text-tiny text-default-400">
                    Signal: {getSignalStrength(network.quality)}% - {network.security}
                  </span>
                </div>
              </SelectItem>
            )}
          </Select>

          <Input
            type="password"
            label="WiFi Password"
            onValueChange={(value) => setWifiPassword(value)}
            placeholder="Enter network password"
            labelPlacement="outside"
            value={wifiPassword}
            classNames={{
              base: "w-full",
              input: "h-12"
            }}
          />
        </div>

        {/* Button Section */}
        <div className="pt-4">
          <Button 
            onClick={() => setWifi(selectedNetwork, wifiPassword)}
            isDisabled={!selectedNetwork || !wifiPassword}
            className="w-full h-12"
            color="primary"
            size="lg"
          >
            Connect
          </Button>
        </div>
      </div>
    </div>
  )
}
