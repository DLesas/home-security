import { ElectronAPI } from '@electron-toolkit/preload'
import { ElectronHandler } from '../main/preload'

type USBDevice = {
  vendorId: number
  productId: number
  manufacturer: string
  product: string
  path: string
}

type API = {
  onWifiNetworksChanged: (callback: (networks: any[]) => void) => void
  removeWifiNetworksChangedListener: (callback: (networks: any[]) => void) => void
  getWifiNetworks: () => Promise<any[]>
  getLocalIpAddress: () => Promise<string>
}

type USB = {
  onDevicesChanged: (callback: (devices: USBDevice[]) => void) => void
  removeDevicesChangedListener: () => void
  getUsbDevices: () => Promise<USBDevice[]>
  writeEnvFile: (data: string, devicePath: string) => Promise<void>
}

type Docker = {
  startLogStream: (serviceName: string, callbacks: {
    onData: (data: string) => void
    onError: (error: string) => void
    onEnd: () => void
  }) => () => void
  stopLogStream: (serviceName: string) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
    usb: USB
    docker: Docker
    electronHandler: ElectronHandler
  }
}

export {}
