import { Input } from "@nextui-org/input";

export default function AlarmSettings({ config, setConfig }) {
  return (
    <div className="col-span-2">
      <h3 className="text-lg font-semibold mb-3">Alarm Settings</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Relay Pin"
          value={config.relay_pin}
          onValueChange={(value) => setConfig({...config, relay_pin: value})}
        />
        <Input
          type="number"
          label="Port"
          value={config.port}
          onValueChange={(value) => setConfig({...config, port: value})}
        />
        <Input
          type="number"
          label="Ping Interval (seconds)"
          value={config.ping_interval_s}
          onValueChange={(value) => setConfig({...config, ping_interval_s: value})}
        />
      </div>
    </div>
  );
} 