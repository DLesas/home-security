import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerRoute } from '../lib/electron-router-dom'
import icon from '../../resources/icon.png?asset'
import { USBDeviceMonitor } from './usb'
import { WiFiMonitor } from './wifi'
import { IpAddressManager } from './ipAddress'
import { checkDockerInstallation } from '../lib/docker'
import { getPlatformInfo, getCpuInfo } from '../lib/systemInfo'
import { DockerService } from '../lib/docker/dockerService'
import { setupDockerHandlers } from './docker'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
const usbMonitor = new USBDeviceMonitor()
const wifiMonitor = new WiFiMonitor()
const ipAddressManager = new IpAddressManager()
const dockerService = new DockerService()

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

 
  const preloadPath = path.join(__dirname, '../preload/index.js')
  fs.access(preloadPath, fs.constants.R_OK, (err) => {
    if (err) {
      console.error('Preload script is not readable:', preloadPath)
    } else {
      console.log('Preload script is readable:', preloadPath)
    }
  })

  console.log(join(__dirname, '../preload/index.js'))

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
    mainWindow.webContents.send('usb-devices-changed', devices)
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
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // --- Docker Check Start ---
  const isDockerInstalled = await checkDockerInstallation()
  if (!isDockerInstalled) {
    const platformInfo = await getPlatformInfo()
    const platform = platformInfo.platform
    let dockerUrl = 'https://www.docker.com/products/docker-desktop/' // Default URL

    if (platform === 'win32') {
      dockerUrl = 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe'
    } else if (platform === 'darwin') {
      const cpuInfo = await getCpuInfo()
      if (cpuInfo.architecture === 'arm64') {
        dockerUrl = 'https://desktop.docker.com/mac/main/arm64/Docker.dmg' // Apple Silicon
      } else if (cpuInfo.architecture === 'x64') {
        dockerUrl = 'https://desktop.docker.com/mac/main/amd64/Docker.dmg' // Intel
      } else {
        // Fallback for other architectures or if detection fails
        console.warn('Could not determine specific Mac architecture, using general download page.')
        dockerUrl = 'https://www.docker.com/products/docker-desktop/'
      }
    } else if (platform === 'linux') {
      dockerUrl = 'https://docs.docker.com/engine/install/#server' // Link to install instructions
    }

    const messageDetail = platform === 'linux'
      ? 'Please follow the instructions on the Docker website to install Docker Engine for your distribution. Would you like to open the instructions page?'
      : 'Please download and run the Docker Desktop installer from the official website. Would you like to open the download page now?'

    const choice = await dialog.showMessageBox({
      type: 'error',
      title: 'Docker Required',
      message: 'Docker is not detected or running. This application requires Docker to function properly.',
      detail: messageDetail,
      buttons: ['Yes, open page', 'Cancel'],
      defaultId: 0,
      cancelId: 1
    })

    if (choice.response === 0) {
      await shell.openExternal(dockerUrl)
      // Inform the user they might need to restart the app after installing Docker.
      await dialog.showMessageBox({
          type: 'info',
          title: 'Installation Guide',
          message: 'The Docker download/instruction page has been opened in your browser.',
          detail: 'Please install Docker and ensure it is running, then restart this application if necessary.',
          buttons: ['OK']
      });
    }
    // Optional: Quit the app if Docker is absolutely mandatory
    // app.quit();
    // return; 
  }
  // --- Docker Check End ---

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC handlers
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.handle('get-local-ip-address', () => {
    return ipAddressManager.getLocalIpAddress()
  })
  ipcMain.handle('get-usb-devices', async () => {
    try {
      return await usbMonitor.getDeviceList()
    } catch (error) {
      console.error('Error getting USB devices:', error)
      return []
    }
  })

  ipcMain.handle('write-env-file', async (_, data: string, devicePath: string) => {
    try {
      await usbMonitor.writeEnvFile(data, devicePath)
    } catch (error) {
      console.error('Error writing env file:', error)
      throw error
    }
  })

  ipcMain.handle('get-wifi-networks', async () => {
    return await wifiMonitor.getNetworks()
  })

  // Set up Docker handlers
  setupDockerHandlers(dockerService)

  // Clean up all streams when the app is quitting
  app.on('before-quit', () => {
    dockerService.stopAllLogStreams()
  })

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
