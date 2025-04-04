import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { is } from '@electron-toolkit/utils'

// Custom APIs for renderer
const api = {
  // WiFi monitoring
  onWifiNetworksChanged: (callback) => ipcRenderer.on('wifi-networks-changed', callback),
  removeWifiNetworksChangedListener: (callback) => ipcRenderer.removeListener('wifi-networks-changed', callback),
  getWifiNetworks: () => ipcRenderer.invoke('get-wifi-networks'),
  
  // IP address
  getLocalIpAddress: () => ipcRenderer.invoke('get-local-ip-address'),
}

// USB monitoring
const usb = {
  onDevicesChanged: (callback: (devices: any[]) => void) => {
    ipcRenderer.on('usb-devices-changed', (_, devices) => callback(devices));
  },
  removeDevicesChangedListener: () => {
    ipcRenderer.removeAllListeners('usb-devices-changed');
  },
  getUsbDevices: () => ipcRenderer.invoke('get-usb-devices'),
  writeEnvFile: (data: string, devicePath: string) => ipcRenderer.invoke('write-env-file', data, devicePath),
}

// Docker service control
const docker = {
  startLogStream: (serviceName: string, callbacks: {
    onData: (data: string) => void
    onError: (error: string) => void
    onEnd: () => void
  }) => {
    // Set up the log stream
    ipcRenderer.invoke('start-log-stream', serviceName)

    // Add listeners for log events
    ipcRenderer.on(`logs:${serviceName}`, (_, data) => callbacks.onData(data))
    ipcRenderer.on(`logs:${serviceName}:error`, (_, error) => callbacks.onError(error))
    ipcRenderer.on(`logs:${serviceName}:end`, () => callbacks.onEnd())

    // Return cleanup function
    return () => {
      ipcRenderer.removeAllListeners(`logs:${serviceName}`)
      ipcRenderer.removeAllListeners(`logs:${serviceName}:error`)
      ipcRenderer.removeAllListeners(`logs:${serviceName}:end`)
      ipcRenderer.invoke('stop-log-stream', serviceName)
    }
  },

  stopLogStream: (serviceName: string) => {
    ipcRenderer.invoke('stop-log-stream', serviceName)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('usb', usb)
    contextBridge.exposeInMainWorld('docker', docker)
  } catch (error) {
    console.error('Failed to expose APIs via contextBridge:', error)
  }
} else if (is.dev) {
  // Development only: Less secure but useful for debugging
  console.warn('Context isolation is disabled - APIs exposed directly to window (development only)')
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.usb = usb
  // @ts-ignore (define in dts)
  window.docker = docker
} else {
  // Production with context isolation disabled - this is a security risk
  console.error('Context isolation is disabled in production - this is a security risk!')
}
