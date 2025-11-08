'use client'

import { useParams, useRouter } from 'next/navigation'
import { useSocketData } from '../../socketData'
import { Button } from '@nextui-org/button'
import { Card } from '@nextui-org/card'
import { Chip } from '@nextui-org/chip'
import { useEffect, useState } from 'react'
import { useSocket } from '../../socketInitializer'

interface SensorUpdate {
  id: string
  sensorId: string
  sensorName: string
  state: 'open' | 'closed' | 'unknown'
  temperature: string
  voltage: string
  frequency: string
  dateTime: string
}

interface LogResponse {
  success: boolean
  data: SensorUpdate[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function SensorDetail() {
  const params = useParams()
  const router = useRouter()
  const { sensors } = useSocketData()
  const { url } = useSocket()
  const [recentActivity, setRecentActivity] = useState<SensorUpdate[]>([])
  const [loadingActivity, setLoadingActivity] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [armLoading, setArmLoading] = useState(false)
  const [disarmLoading, setDisarmLoading] = useState(false)

  const sensorId = params.sensorId as string
  const sensor = sensors.find((s) => s.externalID === sensorId)

  useEffect(() => {
    if (sensor) {
      fetchRecentActivity(1)
    }
  }, [sensor])

  const fetchRecentActivity = async (page: number) => {
    if (!sensor) return

    setLoadingActivity(true)
    try {
      const response = await fetch(
        `${url}/api/v1/logs/sensor-updates?sensorName=${encodeURIComponent(sensor.name)}&limit=10&page=${page}&sort=desc`
      )
      const data: LogResponse = await response.json()

      if (data.success) {
        if (page === 1) {
          setRecentActivity(data.data)
        } else {
          setRecentActivity([...recentActivity, ...data.data])
        }
        setCurrentPage(page)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Failed to fetch recent activity:', error)
    } finally {
      setLoadingActivity(false)
    }
  }

  const handleArm = async () => {
    if (!sensor) return

    setArmLoading(true)
    try {
      await fetch(`${url}/api/v1/sensors/${sensor.externalID}/arm`, {
        method: 'POST',
      })
    } catch (error) {
      console.error('Failed to arm sensor:', error)
    } finally {
      setArmLoading(false)
    }
  }

  const handleDisarm = async () => {
    if (!sensor) return

    setDisarmLoading(true)
    try {
      await fetch(`${url}/api/v1/sensors/${sensor.externalID}/disarm`, {
        method: 'POST',
      })
    } catch (error) {
      console.error('Failed to disarm sensor:', error)
    } finally {
      setDisarmLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getTimeSince = (dateString: string) => {
    const now = new Date()
    const then = new Date(dateString)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  if (!sensor) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Sensor Not Found</h1>
          <Button color="primary" onPress={() => router.push('/home')}>
            Go Back Home
          </Button>
        </div>
      </div>
    )
  }

  const getStateColor = (state: string) => {
    switch (state) {
      case 'open':
        return 'danger'
      case 'closed':
        return 'success'
      default:
        return 'default'
    }
  }

  const getStateLabel = (state: string) => {
    return state.charAt(0).toUpperCase() + state.slice(1)
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-8">
      {/* Back Button */}
      <Button
        variant="light"
        onPress={() => router.push('/home')}
        className="mb-4 sm:mb-6"
        size="lg"
      >
        ← Back to Home
      </Button>

      {/* Sensor Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="mb-2 text-2xl font-bold sm:text-3xl">{sensor.name}</h1>
        <p className="text-base text-gray-500 sm:text-lg">{sensor.building}</p>
      </div>

      {/* Status Card */}
      <Card className="mb-4 p-4 sm:mb-6 sm:p-6">
        <div className="mb-4 flex flex-col gap-4 sm:mb-6">
          {/* Status Chips */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">Status:</span>
              <Chip color={getStateColor(sensor.state)} variant="flat" size="lg">
                {getStateLabel(sensor.state)}
              </Chip>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">Armed:</span>
              <Chip color={sensor.armed ? 'danger' : 'success'} variant="flat" size="lg">
                {sensor.armed ? 'Armed' : 'Disarmed'}
              </Chip>
            </div>
            <div className="text-sm text-gray-500">
              Last Updated: {getTimeSince(sensor.lastUpdated.toString())}
            </div>
          </div>

          {/* Arm/Disarm Buttons - Full width on mobile, side by side on desktop */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              color="danger"
              variant={sensor.armed ? 'solid' : 'bordered'}
              onPress={handleArm}
              isLoading={armLoading}
              isDisabled={sensor.armed}
              size="lg"
              className="w-full"
            >
              {sensor.armed ? 'Armed' : 'Arm Sensor'}
            </Button>
            <Button
              color="success"
              variant={!sensor.armed ? 'solid' : 'bordered'}
              onPress={handleDisarm}
              isLoading={disarmLoading}
              isDisabled={!sensor.armed}
              size="lg"
              className="w-full"
            >
              {!sensor.armed ? 'Disarmed' : 'Disarm Sensor'}
            </Button>
          </div>
        </div>

        {/* Telemetry Section */}
        <div className="border-t pt-4 sm:pt-6">
          <h2 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">📊 Telemetry</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <div className="text-xs text-gray-500 sm:text-sm">🌡️ Temperature</div>
              <div className="text-lg font-semibold sm:text-xl">
                {sensor.temperature !== undefined ? `${sensor.temperature}°C` : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 sm:text-sm">📡 Frequency</div>
              <div className="text-lg font-semibold sm:text-xl">
                {sensor.frequency !== undefined ? `${sensor.frequency}MHz` : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 sm:text-sm">⏱️ Ping Interval</div>
              <div className="text-lg font-semibold sm:text-xl">{sensor.expectedSecondsUpdated}s</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 sm:text-sm">🔋 Voltage</div>
              <div className="text-base text-gray-600 sm:text-lg">
                {sensor.voltage !== undefined ? `${sensor.voltage}V` : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Recent Activity Card */}
      <Card className="p-4 sm:p-6">
        <h2 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">📜 Recent Activity</h2>

        {loadingActivity && currentPage === 1 ? (
          <div className="py-8 text-center text-sm text-gray-500 sm:text-base">
            Loading activity...
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500 sm:text-base">
            No activity recorded yet
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {recentActivity.map((update) => (
                <div
                  key={update.id}
                  className="flex flex-col gap-2 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  {/* Left side: Time and Status */}
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-500 sm:text-sm">
                      {formatDate(update.dateTime)}
                    </div>
                    <Chip
                      color={getStateColor(update.state)}
                      variant="flat"
                      size="sm"
                    >
                      {getStateLabel(update.state)}
                    </Chip>
                  </div>

                  {/* Right side: Telemetry data */}
                  <div className="flex gap-3 text-xs text-gray-600 sm:gap-4 sm:text-sm">
                    <span>🌡️ {update.temperature}°C</span>
                    <span className="text-gray-400">🔋 {update.voltage}V</span>
                  </div>
                </div>
              ))}
            </div>

            {currentPage < totalPages && (
              <div className="mt-4 text-center">
                <Button
                  variant="bordered"
                  onPress={() => fetchRecentActivity(currentPage + 1)}
                  isLoading={loadingActivity}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
