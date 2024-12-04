import { ElectronAPI } from '@electron-toolkit/preload'

type API = {
  saveEnv: (data: any, devicePath: any) => void
  onSaveEnvResult: (callback: any) => Electron.IpcRenderer
  getUSBDevices: () => Promise<{
    vendorId: number
    productId: number
    manufacturer: string
    product: string
  }[]>
  onUsbDevicesUpdated: (
    callback: (
      event: Electron.IpcRendererEvent,
      devices: {
        vendorId: number
        productId: number
        manufacturer: string
        product: string
      }[]
    ) => void
  ) => void
  removeUsbDevicesUpdatedListener: (
    callback: (
      event: Electron.IpcRendererEvent,
      devices: {
        vendorId: number
        productId: number
        manufacturer: string
        product: string
      }[]
    ) => void
  ) => void
  onWifiNetworksChanged: (
    callback: (
      event: Electron.IpcRendererEvent,
      networks: {
        isConnected: boolean
        ssid: string
        quality: number
        security: string
        frequency: number
        signal_level: number
      }[]
    ) => void
  ) => void
  removeWifiNetworksChangedListener: (
    callback: (
      event: Electron.IpcRendererEvent,
      networks: {
        isConnected: boolean
        ssid: string
        quality: number
        security: string
        frequency: number
        signal_level: number
      }[]
    ) => void
  ) => void
  getWifiNetworks: () => Promise<{
    isConnected: boolean
    ssid: string
    quality: number
    security: string
    frequency: number
    signal_level: number
  }[]>
  getLocalIpAddress: () => Promise<string>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
