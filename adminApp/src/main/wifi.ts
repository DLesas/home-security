import si from 'systeminformation'
import { EventEmitter } from 'events'

export interface WiFiNetwork {
  ssid: string
  bssid: string
  quality: number
  security: string[]
  frequency: number
  signalLevel: number
  isConnected?: boolean
  localIpAddress?: string | null
}

export class WiFiMonitor extends EventEmitter {
  private currentNetwork: WiFiNetwork | null = null
  private scanInterval: NodeJS.Timeout | null = null
  
  constructor() {
    super()
    this.startMonitoring()
  }

  private startMonitoring(intervalMs: number = 5000) {
    // Initial scan
    this.updateNetworks()
    
    // Regular scanning
    this.scanInterval = setInterval(() => {
      this.updateNetworks()
    }, intervalMs)
  }

  private async updateNetworks() {
    try {
      // Get WiFi networks and current connection
      const [networks, currentConnection] = await Promise.all([
        si.wifiNetworks(),
        si.wifiConnections()
      ])

      // Get the current connected network
      const currentWifi = currentConnection[0]
      
      // Get local IP address for the current connection
      const localIp = currentWifi ? await this.getLocalIpAddress() : null

      // Transform networks to our format
      const enhancedNetworks = networks.map(network => ({
        ssid: network.ssid,
        bssid: network.bssid,
        quality: network.quality,
        security: network.security,
        frequency: network.frequency,
        signalLevel: network.signalLevel,
        isConnected: currentWifi?.ssid === network.ssid,
        localIpAddress: currentWifi?.ssid === network.ssid ? localIp : undefined
      }))

      this.currentNetwork = currentWifi ? enhancedNetworks.find(n => n.isConnected) || null : null
      this.emit('networksChanged', enhancedNetworks)
      return enhancedNetworks
    } catch (error) {
      console.error('Error scanning WiFi networks:', error)
      return []
    }
  }

  private async getLocalIpAddress(): Promise<string | null> {
    try {
      const networkInterfaces = await si.networkInterfaces();
      const interfaces = Array.isArray(networkInterfaces) ? networkInterfaces : [networkInterfaces];
      const wifiInterface = interfaces.find(iface => 
        iface.operstate === 'up' && 
        (iface.type === 'wireless' || iface.type === 'wifi')
      );

      if (wifiInterface) {
        const ipv4 = wifiInterface.ip4;
        return ipv4 || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting local IP address:', error);
      return null;
    }
  }

  public stopMonitoring() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval)
      this.scanInterval = null
    }
  }

  public async getNetworks(): Promise<WiFiNetwork[]> {
    return this.updateNetworks()
  }
}

