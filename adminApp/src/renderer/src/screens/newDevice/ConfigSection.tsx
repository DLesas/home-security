import { useState } from 'react'
import { Button } from '@nextui-org/button'
import { Listbox, ListboxItem } from '@nextui-org/listbox'
import { Input } from '@nextui-org/input'
import AlarmSettings from './settings/AlarmSettings'
import DoorSensorSettings from './settings/DoorSensorSettings'
import ServerSettings from './settings/ServerSettings'
import NetworkSettings from './settings/NetworkSettings'

type DeviceType = 'alarm_relay' | 'door_sensor' | 'camera'

export default function ConfigSection({
  wifi,
  wifipassword,
  usb,
  defaultDeviceType
}: {
  wifi: string
  wifipassword: string
  usb: string
  defaultDeviceType: DeviceType
}) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [wifiPassword, setWifiPassword] = useState(wifipassword)
  
  window.api.getLocalIpAddress().then(console.log)

  // State for form values
  const [config, setConfig] = useState({
    // Alarm specific
    relay_pin: 'GP22',
    port: '8000',
    ping_interval_s: '1800',

    // Door Sensor specific
    door_switch_pin: 'GP22',
    time_to_sleep_s: '300',

    // General
    user_agent: 'Alarm_v1',
    server_ip: '192.168.0.4',
    server_port: '8080',
    server_ssl: false,
    server_udp_port: '41234',
    server_service_name: 'SecurityGeneralServer',
    server_password: '',
    tcp_timeout: '5',
    tcp_port: '31337',
    deviceType: defaultDeviceType,

    // Network settings
    max_wifi_attempts: '15',
    wifi_blinks: '5',
    max_networking_attempts: '10',
    networking_blinks: '7'
  })

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="p-4 rounded-lg border-2 border-default-200 space-y-4">
        {/* Basic Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Selected WiFi" value={wifi} isReadOnly />
          <Input label="Selected USB Port" value={usb} isReadOnly />
          <Input
            type="password"
            label="WiFi Password"
            isReadOnly
            value={wifiPassword}
            onValueChange={setWifiPassword}
                      
            isRequired
          />
          <Listbox
            label="Device Type"
            selectedKeys={[config.deviceType]}
            onSelectionChange={(keys) =>
              setConfig({ ...config, deviceType: Array.from(keys)[0] as DeviceType })
            }
            selectionMode="single"
            className="max-w-xs"
          >
            <ListboxItem key="alarm_relay">Alarm Relay</ListboxItem>
            <ListboxItem key="door_sensor">Door Sensor</ListboxItem>
            <ListboxItem key="camera">Camera</ListboxItem>
          </Listbox>
        </div>

        {/* Advanced Configuration Button */}
        <Button
          className="w-full"
          color="secondary"
          onPress={() => setIsAdvancedOpen(!isAdvancedOpen)}
        >
          {isAdvancedOpen ? 'Hide Advanced Configuration' : 'Show Advanced Configuration'}
        </Button>

        {/* Advanced Configuration Sections */}
        {isAdvancedOpen && (
          <div className="space-y-6">
            {/* Device Specific Settings */}
            {config.deviceType === 'alarm_relay' && (
              <AlarmSettings config={config} setConfig={setConfig} />
            )}
            {config.deviceType === 'door_sensor' && (
              <DoorSensorSettings config={config} setConfig={setConfig} />
            )}

            {/* Common Settings */}
            <ServerSettings config={config} setConfig={setConfig} />
            <NetworkSettings config={config} setConfig={setConfig} />
          </div>
        )}

        {/* Save Button */}
        <Button
          color="primary"
          className="w-full mt-4"
          isDisabled={!wifiPassword}
          onPress={() => {
            console.log('Saving config:', {
              ...config,
              wifiPassword
            })
          }}
        >
          Save Configuration
        </Button>
      </div>
    </div>
  )
}
