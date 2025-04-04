import { ipcMain } from 'electron'
import { DockerService } from '../lib/docker/dockerService'

export function setupDockerHandlers(dockerService: DockerService): void {
  // Docker log streaming handlers
  ipcMain.handle('start-log-stream', async (event, serviceName: string) => {
    try {
      // Set up the log stream
      const stream = await dockerService.getServiceLogs(serviceName, true)

      // Forward log events to the renderer
      const forwardLogs = (data: string) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(`logs:${serviceName}`, data)
        }
      }

      const forwardError = (error: Error) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(`logs:${serviceName}:error`, error.message)
        }
      }

      const handleEnd = () => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(`logs:${serviceName}:end`)
        }
      }

      // Listen to the events from DockerService
      dockerService.on(`logs:${serviceName}`, forwardLogs)
      dockerService.on(`logs:${serviceName}:error`, forwardError)
      dockerService.on(`logs:${serviceName}:end`, handleEnd)

      // Return a cleanup function that will be called when the window is closed
      return () => {
        dockerService.off(`logs:${serviceName}`, forwardLogs)
        dockerService.off(`logs:${serviceName}:error`, forwardError)
        dockerService.off(`logs:${serviceName}:end`, handleEnd)
        dockerService.stopLogStream(serviceName)
      }
    } catch (error) {
      console.error('Error starting log stream:', error)
      throw error
    }
  })

  ipcMain.handle('stop-log-stream', (_, serviceName: string) => {
    dockerService.stopLogStream(serviceName)
  })
} 