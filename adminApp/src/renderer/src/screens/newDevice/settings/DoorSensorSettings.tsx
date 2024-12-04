import { Input } from "@nextui-org/input";

export default function DoorSensorSettings({ config, setConfig }) {
  return (
    <div className="col-span-2">
      <h3 className="text-lg font-semibold mb-3">Door Sensor Settings</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Door Switch Pin"
          value={config.door_switch_pin}
          onValueChange={(value) => setConfig({...config, door_switch_pin: value})}
        />
        <Input
          type="number"
          label="Sleep Time (seconds)"
          value={config.time_to_sleep_s}
          onValueChange={(value) => setConfig({...config, time_to_sleep_s: value})}
        />
      </div>
    </div>
  );
} 