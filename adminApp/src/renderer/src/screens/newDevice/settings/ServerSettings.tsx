import { Input } from "@nextui-org/input";
import { Switch } from "@nextui-org/switch";

export default function ServerSettings({ config, setConfig }) {
  return (
    <div className="col-span-2">
      <h3 className="text-lg font-semibold mb-3">Server Configuration</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Server IP"
          value={config.server_ip}
          onValueChange={(value) => setConfig({...config, server_ip: value})}
        />
        <Input
          type="number"
          label="Server Port"
          value={config.server_port}
          onValueChange={(value) => setConfig({...config, server_port: value})}
        />
        <Input
          type="number"
          label="UDP Port"
          value={config.server_udp_port}
          onValueChange={(value) => setConfig({...config, server_udp_port: value})}
        />
        <Input
          label="Service Name"
          value={config.server_service_name}
          onValueChange={(value) => setConfig({...config, server_service_name: value})}
        />
        <Input
          type="password"
          label="Server Password"
          value={config.server_password}
          onValueChange={(value) => setConfig({...config, server_password: value})}
        />
        <Switch
          isSelected={config.server_ssl}
          onValueChange={(value) => setConfig({...config, server_ssl: value})}
        >
          Enable SSL
        </Switch>
      </div>
    </div>
  );
} 