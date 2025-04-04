import si from 'systeminformation'
import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'

export interface USBDevice {
  vendorId: string
  productId: string | number
  manufacturer: string
  deviceName: string
  devicePath?: string
  serialNumber?: string
}

export class USBDeviceMonitor extends EventEmitter {
  private scanInterval: NodeJS.Timeout | null = null
  private previousDevices: USBDevice[] = []
  
  constructor() {
    super()
    this.startMonitoring()
  }

  private startMonitoring(intervalMs: number = 3000) {
    // Initial scan
    this.updateDevices()
    
    // Regular scanning
    this.scanInterval = setInterval(() => {
      this.updateDevices()
    }, intervalMs)
  }

  private getDeviceKey(device: USBDevice): string {
    // Create a more stable key that includes multiple identifying properties
    const keyParts = [
      device.manufacturer,
      device.deviceName,
    ]
    return keyParts.join('|')
  }

  private async updateDevices() {
    try {
      const currentDevices = await this.getDeviceList()
      
      // Create a map of existing devices for quick lookup
      const existingDeviceMap = new Map(
        this.previousDevices.map(device => [
          this.getDeviceKey(device),
          device
        ])
      )

      // Create a map of current devices for quick lookup
      const currentDeviceMap = new Map(
        currentDevices.map(device => [
          this.getDeviceKey(device),
          device
        ])
      )

      // Find new devices (not in previous list)
      const newDevices = currentDevices.filter(device => 
        !existingDeviceMap.has(this.getDeviceKey(device))
      )

      // Find removed devices (in previous list but not in current)
      const removedDevices = this.previousDevices.filter(device => 
        !currentDeviceMap.has(this.getDeviceKey(device))
      )

      // If there are any changes, update the list while maintaining order
      if (newDevices.length > 0 || removedDevices.length > 0) {
        // Keep existing devices in their current order
        const orderedDevices = this.previousDevices.filter(device => 
          currentDeviceMap.has(this.getDeviceKey(device))
        );

        // Add new devices at the end
        const updatedDevices = [...orderedDevices, ...newDevices];

        this.emit('devicesChanged', updatedDevices)
        this.previousDevices = updatedDevices
        return updatedDevices
      }

      return this.previousDevices
    } catch (error) {
      console.error('Error scanning USB devices:', error)
      return this.previousDevices // Return previous devices on error to maintain stability
    }
  }

  public async getDeviceList(): Promise<USBDevice[]> {
    try {
      const usbDevices = await si.usb()
      return usbDevices.map(device => ({
        vendorId: device.vendor,
        productId: device.id,
        manufacturer: device.manufacturer || 'Unknown',
        deviceName: device.name || 'Unknown',
        serialNumber: device.serialNumber,
        devicePath: this.getDevicePath(device)
      }))
    } catch (error) {
      console.error('Error getting USB device list:', error)
      return []
    }
  }

  private getDevicePath(device: any): string | undefined {
    try {
      // On Windows, we can try to find the device path
      if (process.platform === 'win32') {
        // This is a simplified approach - you might want to enhance this
        // based on your specific needs
        return `\\\\?\\USB#VID_${device.vendorId}&PID_${device.productId}#${device.serialNumber || ''}`
      }
      return undefined
    } catch (error) {
      console.error('Error getting device path:', error)
      return undefined
    }
  }

  public async writeEnvFile(data: string, devicePath: string): Promise<void> {
    try {
      // Ensure the device path exists
      if (!fs.existsSync(devicePath)) {
        throw new Error('Device path does not exist')
      }

      // Write the data to a file in the device's root directory
      const filePath = path.join(devicePath, 'env.txt')
      await fs.promises.writeFile(filePath, data, 'utf8')
    } catch (error) {
      console.error('Error writing env file:', error)
      throw error
    }
  }

  public stopMonitoring() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval)
      this.scanInterval = null
    }
  }
}
