import wifi from 'node-wifi'
import { EventEmitter } from 'events'
import { networkInterfaces } from 'os'

export interface WiFiNetwork {
  ssid: string
  quality: number
  security: string
  frequency: number
  signal_level: number
  isConnected?: boolean
  localIpAddress?: string | null
}

export class WiFiMonitor extends EventEmitter {
  private currentNetwork: WiFiNetwork | null = null
  private scanInterval: NodeJS.Timeout | null = null
  
  constructor() {
    super()
    wifi.init({
      iface: null,
    })
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
      const networks = await wifi.scan()
      
      const currentConnection = await this.getCurrentConnection()
      console.log('currentConnection', currentConnection)
      // Get the WiFi interface name based on platform
      const wifiInterface = this.getWifiInterfaceName();
      const localIp = wifiInterface ? this.getLocalIPv4ForInterface(wifiInterface) : null;
      console.log('localIp', localIp)
      const enhancedNetworks = networks.map((network: WiFiNetwork) => ({
        ...network,
        isConnected: currentConnection?.ssid === network.ssid,
        localIpAddress: network.ssid === currentConnection?.ssid ? localIp : undefined
      }))
      console.log('enhancedNetworks', enhancedNetworks)

      this.currentNetwork = currentConnection
      this.emit('networksChanged', enhancedNetworks)
      return enhancedNetworks
    } catch (error) {
      console.error('Error scanning WiFi networks:', error)
      return []
    }
  }

  public async getCurrentConnection(): Promise<WiFiNetwork | null> {
    try {
      const currentConnection = await wifi.getCurrentConnections()
      if (!currentConnection?.[0]) return null;
      
      const connection = currentConnection[0];
      
      // On Windows, if SSID is 'connected', use BSSID instead
      if (process.platform === 'win32' && connection.ssid === 'connected' && connection.bssid) {
        connection.ssid = connection.bssid;
      }
      
      return connection
    } catch (error) {
      console.error('Error getting current WiFi connection:', error)
      return null
    }
  }

//   public async connect(ssid: string, password: string): Promise<void> {
//     try {
//       await wifi.connect({ ssid, password })
//       await this.updateNetworks() // Refresh the network list after connection
//     } catch (error) {
//       console.error('Error connecting to WiFi:', error)
//       throw error
//     }
//   }

//   public async disconnect(): Promise<void> {
//     try {
//       await wifi.disconnect()
//       await this.updateNetworks()
//     } catch (error) {
//       console.error('Error disconnecting from WiFi:', error)
//       throw error
//     }
//   }

  public stopMonitoring() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval)
      this.scanInterval = null
    }
  }

  public async getNetworks(): Promise<WiFiNetwork[]> {
    return this.updateNetworks()
  }

  private getWifiInterfaceName(): string | null {
    const platform = process.platform;
    
    // Get all network interfaces
    const interfaces = networkInterfaces();
    switch (platform) {
      case 'win32': // Windows
        return Object.keys(interfaces).find(name => 
          name.toLowerCase().includes('wi-fi') || 
          name.toLowerCase().includes('wireless')
        ) || null;
        
      case 'darwin': // macOS
        return Object.keys(interfaces).find(name => 
          name.toLowerCase().startsWith('en')
        ) || null;
        
      case 'linux': // Linux
        return Object.keys(interfaces).find(name => 
          name.toLowerCase().includes('wlan')
        ) || null;
        
      default:
        return null;
    }
  }

  private getLocalIPv4ForInterface(interfaceName: string): string | null {
    const interfaces = networkInterfaces();
    const interfaceInfo = interfaces[interfaceName];
    if (!interfaceInfo) return null;

    for (const address of interfaceInfo) {
      if (address.family === 'IPv4') {
        return address.address;
      }
    }
    return null;
  }
}

