'use client'

import { Button } from '@nextui-org/button'
import { Input } from '@nextui-org/input'
import { useRouter } from 'next/navigation'
import { useSocket } from './socketInitializer'
import { detectBestEndpoint } from '../lib/networkDetection'
import { useState, useEffect } from 'react'

const vpnIP = '100.77.41.71'
//const homeIP = '192.168.226.94' //'192.168.0.126'
//const homeIP = '192.168.0.126' //'192.168.0.116'
const homeIP = '192.168.5.157'

export default function SelectSocket() {
  const router = useRouter()
  const { socket, setUrl, url } = useSocket()
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectionFailed, setDetectionFailed] = useState(false)
  const [detectedEndpoint, setDetectedEndpoint] = useState<string | null>(null)
  const [manualIP, setManualIP] = useState('')

  // Try auto-detection on component mount
  useEffect(() => {
    handleAutoDetection()
  }, [])

  const handleAutoDetection = async () => {
    setIsDetecting(true)
    setDetectionFailed(false)

    try {
      const endpoint = await detectBestEndpoint()
      if (endpoint) {
        setDetectedEndpoint(endpoint.name)
        setUrl(endpoint.url)
        // Auto-navigate after successful detection
        setTimeout(() => {
          router.push('/home')
        }, 1000) // Brief delay to show detection result
      } else {
        setDetectionFailed(true)
      }
    } catch (error) {
      console.error('Auto-detection failed:', error)
      setDetectionFailed(true)
    } finally {
      setIsDetecting(false)
    }
  }

  const handleManualConnection = () => {
    if (manualIP.trim()) {
      const url = manualIP.startsWith('http')
        ? manualIP
        : `http://${manualIP}:8080`
      setUrl(url)
      router.push('/home')
    }
  }

  if (isDetecting) {
    return (
      <div className="flex w-full flex-col items-center gap-6">
        <div className="text-lg">🔍 Scanning network...</div>
        <div className="text-sm text-gray-500">
          This might take a few seconds...
        </div>
      </div>
    )
  }

  if (detectedEndpoint && !detectionFailed) {
    return (
      <div className="flex w-full flex-col items-center gap-6">
        <div className="text-lg">✅ Connected to: {detectedEndpoint}</div>
        <div className="text-sm text-gray-500">Redirecting to home...</div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
      <div className="mb-4 text-center">
        <h1 className="mb-2 text-2xl font-bold">Home Security System</h1>
        <p className="text-gray-600">Connect to your server</p>
      </div>

      {/* Auto-detection section */}
      <div className="w-full">
        <Button
          className="w-full"
          color="primary"
          onClick={handleAutoDetection}
          disabled={isDetecting}
        >
          🔍 Try Auto-Detection
        </Button>
        <p className="mt-1 text-center text-xs text-gray-500">
          Scans common network addresses
        </p>
      </div>

      <div className="flex w-full items-center gap-2">
        <hr className="flex-1" />
        <span className="text-sm text-gray-500">or</span>
        <hr className="flex-1" />
      </div>

      {/* Manual IP entry */}
      <div className="w-full space-y-3">
        <div>
          <Input
            label="Server IP Address"
            placeholder="192.168.1.100 or http://192.168.1.100:8080"
            value={manualIP}
            onChange={(e) => setManualIP(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleManualConnection()}
          />
        </div>
        <Button
          className="w-full"
          color="secondary"
          onClick={handleManualConnection}
          disabled={!manualIP.trim()}
        >
          Connect Manually
        </Button>
      </div>

      <div className="flex w-full items-center gap-2">
        <hr className="flex-1" />
        <span className="text-sm text-gray-500">quick options</span>
        <hr className="flex-1" />
      </div>

      {/* Quick preset buttons */}
      <div className="w-full space-y-2">
        <Button
          variant="bordered"
          className="w-full"
          onClick={() => {
            setUrl(`http://${homeIP}:8080`)
            router.push('/home')
          }}
        >
          🏠 Home Network ({homeIP})
        </Button>

        <Button
          variant="bordered"
          className="w-full"
          onClick={() => {
            setUrl(`http://${vpnIP}:8080`)
            router.push('/home')
          }}
        >
          🔒 VPN ({vpnIP})
        </Button>

        <Button
          variant="bordered"
          className="w-full"
          onClick={() => {
            setUrl(`http://192.168.96.1:8080`)
            router.push('/home')
          }}
        >
          🧪 Test Network
        </Button>
      </div>

      {detectionFailed && (
        <div className="text-center text-sm text-red-500">
          ⚠️ Auto-detection failed. Try manual entry or check your network
          connection.
        </div>
      )}
    </div>
  )
}
