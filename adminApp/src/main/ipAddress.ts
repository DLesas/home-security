import { networkInterfaces } from 'os';

export class IpAddressManager {
  public getLocalIpAddress(): string {
    try {
      const interfaces = networkInterfaces();
      // Get the first non-internal IPv4 address
      const preAddress = Object.values(interfaces)
        .flat()
        .filter(iface => iface && iface.family === 'IPv4' && !iface.internal)
    
        console.log(preAddress)
     const address = preAddress.map(iface => iface?.address)[0];
      
      return address || '';
    } catch (error) {
      console.error('Error getting local IP address:', error);
      return '';
    }
  }
}
