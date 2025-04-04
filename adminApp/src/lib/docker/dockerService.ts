import Docker from 'dockerode'
import compose from 'docker-compose'
import path from 'path'
import { readFile } from 'fs/promises'
import yaml from 'js-yaml'
import { EventEmitter } from 'events'

export interface ServiceStatus {
  name: string
  status: 'running' | 'stopped' | 'error'
  ports: string[]
  health?: string
  containerId?: string
}

export class DockerService extends EventEmitter {
  private docker: Docker
  private composePath: string
  private serviceNames: string[] = []
  private activeStreams: Map<string, any> = new Map()

  constructor() {
    super()
    this.docker = new Docker()
    // This is going to cause me a headache at some point
    //  as we havent defined where the docker-compose.yml
    //  file is going to live once the adminApp downloads
    //  the file from the server.
    this.composePath = path.join(process.cwd()) 
    this.loadServiceNames()
  }

  /**
   * Load service names from docker-compose.yml
   */
  private async loadServiceNames(): Promise<void> {
    try {
      const composeFile = await readFile(path.join(this.composePath, 'docker-compose.yml'), 'utf8')
      const composeConfig = yaml.load(composeFile) as { services?: Record<string, any> }
      
      if (composeConfig.services) {
        this.serviceNames = Object.keys(composeConfig.services)
        console.log('Loaded services:', this.serviceNames)
      } else {
        console.warn('No services found in docker-compose.yml')
        this.serviceNames = []
      }
    } catch (error) {
      console.error('Error loading docker-compose.yml:', error)
      throw error
    }
  }

  /**
   * Get list of service names from docker-compose.yml
   */
  async getServiceNames(): Promise<string[]> {
    if (this.serviceNames.length === 0) {
      await this.loadServiceNames()
    }
    return this.serviceNames
  }

  /**
   * Validate service name exists in docker-compose.yml
   */
  private validateServiceName(serviceName: string): void {
    if (!this.serviceNames.includes(serviceName)) {
      throw new Error(`Service "${serviceName}" not found in docker-compose.yml`)
    }
  }

  /**
   * Start specific service from docker-compose.yml
   */
  async startService(serviceName: string): Promise<void> {
    this.validateServiceName(serviceName)
    try {
      await compose.upOne(serviceName, {
        cwd: this.composePath,
        log: true,
        commandOptions: ['--build']
      })
    } catch (error) {
      console.error(`Error starting service ${serviceName}:`, error)
      throw error
    }
  }

  /**
   * Start all services defined in docker-compose.yml
   */
  async startServices(): Promise<void> {
    try {
      await compose.upAll({
        cwd: this.composePath,
        log: true,
        commandOptions: ['--build']
      })
    } catch (error) {
      console.error('Error starting services:', error)
      throw error
    }
  }

  /**
   * Stop specific service from docker-compose.yml
   */
  async stopService(serviceName: string): Promise<void> {
    this.validateServiceName(serviceName)
    try {
      await compose.stopOne(serviceName, {
        cwd: this.composePath,
        log: true
      })
    } catch (error) {
      console.error(`Error stopping service ${serviceName}:`, error)
      throw error
    }
  }

  /**
   * Stop all services defined in docker-compose.yml
   */
  async stopServices(): Promise<void> {
    try {
      await compose.down({
        cwd: this.composePath,
        log: true
      })
    } catch (error) {
      console.error('Error stopping services:', error)
      throw error
    }
  }

  /**
   * Restart specific service from docker-compose.yml
   */
  async restartService(serviceName: string): Promise<void> {
    this.validateServiceName(serviceName)
    try {
      await compose.restartOne(serviceName, {
        cwd: this.composePath,
        log: true
      })
    } catch (error) {
      console.error(`Error restarting service ${serviceName}:`, error)
      throw error
    }
  }

  /**
   * Get status of a specific service
   */
  async getServiceStatus(serviceName: string): Promise<ServiceStatus | null> {
    this.validateServiceName(serviceName)
    try {
      const allStatus = await this.getServicesStatus()
      return allStatus.find(status => status.name === serviceName) || null
    } catch (error) {
      console.error(`Error getting status for service ${serviceName}:`, error)
      return null
    }
  }

  /**
   * Get status of all services
   */
  async getServicesStatus(): Promise<ServiceStatus[]> {
    try {
      const composeResult = await compose.ps({
        cwd: this.composePath,
        commandOptions: ['--format', 'json']
      })

      const containers = await this.docker.listContainers({ all: true })

      if (!composeResult.out) {
        return []
      }

      const services = JSON.parse(composeResult.out)
      return services.map((service: any) => {
        const container = containers.find(c => c.Names.some(n => n.includes(service.Service)))
        
        return {
          name: service.Service,
          status: service.State === 'running' ? 'running' : 'stopped',
          ports: service.Ports ? service.Ports.split(',').map((p: string) => p.trim()) : [],
          health: service.Health,
          containerId: container?.Id
        }
      })
    } catch (error) {
      console.error('Error getting services status:', error)
      return []
    }
  }

  /**
   * Get logs for a specific service with real-time streaming support
   */
  async getServiceLogs(serviceName: string, follow = false): Promise<any | string> {
    this.validateServiceName(serviceName)
    try {
      if (follow) {
        // Check if we already have an active stream for this service
        const existingStream = this.activeStreams.get(serviceName)
        if (existingStream) {
          return existingStream
        }

        const containers = await this.docker.listContainers()
        const container = containers.find(c => c.Names.some(n => n.includes(serviceName)))
        
        if (!container) {
          throw new Error(`Running container for service ${serviceName} not found`)
        }

        const dockerContainer = this.docker.getContainer(container.Id)
        const stream = await dockerContainer.logs({
          follow: true,
          stdout: true,
          stderr: true,
          timestamps: true,
          tail: 1000 // Get last 1000 lines of history
        })

        this.activeStreams.set(serviceName, stream)

        stream.on('data', (chunk: Buffer) => {
          const log = chunk.toString().trim()
          if (log) {
            this.emit(`logs:${serviceName}`, log)
          }
        })

        stream.on('error', (error: Error) => {
          console.error(`Log stream error for ${serviceName}:`, error)
          this.emit(`logs:${serviceName}:error`, error)
          this.stopLogStream(serviceName)
        })

        stream.on('end', () => {
          this.emit(`logs:${serviceName}:end`)
          this.stopLogStream(serviceName)
        })

        return stream
      } else {
        const result = await compose.logs(serviceName, {
          cwd: this.composePath,
          commandOptions: ['--tail', '100']
        })
        return result.out || ''
      }
    } catch (error) {
      console.error(`Error getting logs for service ${serviceName}:`, error)
      throw error
    }
  }

  /**
   * Stop streaming logs for a service
   * 
   * Note: The stream returned by dockerode's logs() method is a Node.js stream
   * that implements the standard stream interface including destroy().
   * We use 'any' type here because dockerode's types don't explicitly define
   * the stream interface, but we know it follows Node.js stream patterns.
   */
  stopLogStream(serviceName: string): void {
    const stream = this.activeStreams.get(serviceName)
    if (stream) {
      try {
        // The stream should have a destroy() method as per dockerode's implementation
        stream.destroy()
      } catch (error) {
        console.error(`Error destroying log stream for service ${serviceName}:`, error)
        // Continue with cleanup even if destroy fails
      } finally {
        this.activeStreams.delete(serviceName)
        this.emit(`logs:${serviceName}:stopped`)
      }
    }
  }

  /**
   * Stop all active log streams
   */
  stopAllLogStreams(): void {
    for (const [serviceName] of this.activeStreams) {
      this.stopLogStream(serviceName)
    }
  }

  /**
   * Check if Docker is running
   */
  async isDockerRunning(): Promise<boolean> {
    try {
      await this.docker.ping()
      return true
    } catch (error) {
      return false
    }
  }
} 