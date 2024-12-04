import fs from 'fs'
import usb from 'usb'
import { EventEmitter } from 'events'

export class USBDeviceMonitor extends EventEmitter {
  private devices: Map<string, usb.Device> = new Map()

  constructor() {
    super()
    this.startMonitoring()
  }

  private startMonitoring() {
    usb.usb.on('attach', (device) => this.handleDeviceChange(device, 'add'))
    usb.usb.on('detach', (device) => this.handleDeviceChange(device, 'remove'))
    this.updateDevices()
  }

  private async handleDeviceChange(device: usb.Device, action: 'add' | 'remove') {
    const deviceId = `${device.deviceDescriptor.idVendor}:${device.deviceDescriptor.idProduct}`
    if (action === 'add') {
      this.devices.set(deviceId, device)
    } else {
      this.devices.delete(deviceId)
    }
    this.emit('devicesChanged', await this.getDeviceList())
  }

  private updateDevices() {
    const currentDevices = usb.getDeviceList()
    this.devices.clear()
    currentDevices.forEach((device) => {
      const deviceId = `${device.deviceDescriptor.idVendor}:${device.deviceDescriptor.idProduct}`
      this.devices.set(deviceId, device)
    })
    this.emit('devicesChanged', this.getDeviceList())
  }

  async getDeviceList() {
    const deviceList: {
      vendorId: number
      productId: number
      manufacturer: string
      product: string
    }[] = []
    for (const device of this.devices.values()) {
      try {
        device.open()
        const manufacturer = await this.getStringDescriptor(
          device,
          device.deviceDescriptor.iManufacturer
        )
        const product = await this.getStringDescriptor(device, device.deviceDescriptor.iProduct)
        deviceList.push({
          vendorId: device.deviceDescriptor.idVendor,
          productId: device.deviceDescriptor.idProduct,
          manufacturer,
          product
        })
      } catch (error) {
        console.error(
          `Error processing device ${device.deviceDescriptor.idVendor}:${device.deviceDescriptor.idProduct}:`,
          error
        )
      } finally {
        device.close()
      }
    }
    return deviceList
  }

  private getStringDescriptor(device: usb.Device, index: number): Promise<string> {
    return new Promise((resolve, reject) => {
      device.getStringDescriptor(index, (err, data) => {
        if (err) {
          reject(err)
        } else {
          resolve(data || String(index))
        }
      })
    })
  }
}

export function writeEnvFile(data, devicePath) {
  const envContent = Object.entries(data)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  fs.writeFileSync(devicePath, envContent)
}
