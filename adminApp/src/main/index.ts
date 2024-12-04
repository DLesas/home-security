import { app, shell, BrowserWindow, ipcMain } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerRoute } from '../lib/electron-router-dom'
import icon from '../../resources/icon.png?asset'
import { USBDeviceMonitor, writeEnvFile } from './usb'
import { WiFiMonitor } from './wifi'
import { IpAddressManager } from './ipAddress'


let mainWindow: BrowserWindow | null = null
const usbMonitor = new USBDeviceMonitor()
const wifiMonitor = new WiFiMonitor()
const ipAddressManager = new IpAddressManager()

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  registerRoute({
    id: 'main',
    browserWindow: mainWindow,
    htmlFile: path.join(__dirname, '../renderer/index.html'),
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  // if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
  //   mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  // } else {
  //   mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  // }

  usbMonitor.on('devicesChanged', (devices) => {
    mainWindow?.webContents.send('usb-devices-updated', devices)
  })

  // Listen for network changes
  wifiMonitor.on('networksChanged', (networks) => {
    // Send to renderer process
    mainWindow.webContents.send('wifi-networks-updated', networks)
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.handle('get-local-ip-address', () => {
    return ipAddressManager.getLocalIpAddress()
  })
  ipcMain.handle('get-usb-devices', () => {
    return usbMonitor.getDeviceList()
  })

  ipcMain.on('save-env', (event, data, devicePath) => {
    try {
      writeEnvFile(data, devicePath)
      event?.reply('save-env-result', { success: true })
    } catch (error) {
      event?.reply('save-env-result', { success: false, error: (error as Error).message })
    }
  })

  ipcMain.handle('get-wifi-networks', async () => {
    return await wifiMonitor.getNetworks()
  })

  // ipcMain.handle('connect-wifi', async (_, ssid: string, password: string) => {
  //   await wifiMonitor.connect(ssid, password)
  // })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
