import { Input } from "@nextui-org/input";

export default function NetworkSettings({ config, setConfig }) {
  return (
    <div className="col-span-2">
      <h3 className="text-lg font-semibold mb-3">Network Settings</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          type="number"
          label="Max WiFi Attempts"
          value={config.max_wifi_attempts}
          onValueChange={(value) => setConfig({...config, max_wifi_attempts: value})}
        />
        <Input
          type="number"
          label="WiFi Blinks"
          value={config.wifi_blinks}
          onValueChange={(value) => setConfig({...config, wifi_blinks: value})}
        />
        <Input
          type="number"
          label="Max Networking Attempts"
          value={config.max_networking_attempts}
          onValueChange={(value) => setConfig({...config, max_networking_attempts: value})}
        />
        <Input
          type="number"
          label="Networking Blinks"
          value={config.networking_blinks}
          onValueChange={(value) => setConfig({...config, networking_blinks: value})}
        />
      </div>
    </div>
  );
} 