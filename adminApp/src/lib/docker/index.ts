import { exec } from 'child_process'

export async function checkDockerInstallation(): Promise<boolean> {
  return new Promise((resolve) => {
    exec('docker --version', (error, stdout, stderr) => {
      if (error) {
        console.error('Docker check failed:', error, stderr)
        resolve(false)
      } else {
        console.log('Docker check successful:', stdout)
        resolve(true)
      }
    })
  })
}