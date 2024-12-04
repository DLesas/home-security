import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  saveEnv: (data, devicePath) => ipcRenderer.send('save-env', data, devicePath),
  onSaveEnvResult: (callback) => ipcRenderer.on('save-env-result', (_, result) => callback(result)),
  getUSBDevices: () => ipcRenderer.invoke('get-usb-devices'),
  onUsbDevicesUpdated: (callback) => ipcRenderer.on('usb-devices-updated', callback),
  removeUsbDevicesUpdatedListener: (callback) => ipcRenderer.removeListener('usb-devices-updated', callback),
  onWifiNetworksChanged: (callback) => ipcRenderer.on('wifi-networks-changed', callback),
  removeWifiNetworksChangedListener: (callback) => ipcRenderer.removeListener('wifi-networks-changed', callback),
  getWifiNetworks: () => ipcRenderer.invoke('get-wifi-networks'),
  getLocalIpAddress: () => ipcRenderer.invoke('get-local-ip-address'),
}



// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
