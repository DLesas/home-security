'use client'

import { Card, CardHeader, CardBody } from '@nextui-org/card'
import { MdSpeed, MdMemory, MdVideoSettings, MdMotionPhotosOn } from 'react-icons/md'
import { type CameraStats } from '@/hooks/useCameraStream'
import {
  type Camera,
  type DetectionModel,
  type SimpleDiffSettings,
  type KNNSettings,
  type MOG2Settings,
} from '../../socketData'
import { isFullFrameMotionZone } from '@/shared/camera'

interface CameraStatsCardProps {
  camera: Camera
  stats: CameraStats | null
  clientFps: number
}

interface StatItem {
  icon: React.ReactNode
  label: string
  value: string
}

export function CameraStatsCard({ camera, stats, clientFps }: CameraStatsCardProps) {
  const streamStats: StatItem[] = [
    {
      icon: <MdSpeed className="text-sm" />,
      label: 'Client FPS',
      value: clientFps > 0 ? `${clientFps.toFixed(1)}` : 'N/A',
    },
    {
      icon: <MdSpeed className="text-sm" />,
      label: 'Server FPS',
      value: stats ? `${stats.fps.toFixed(1)}` : 'N/A',
    },
    {
      icon: <MdMemory className="text-sm" />,
      label: 'Frame Size',
      value: stats ? `${(stats.jpegSizeMB * 1024).toFixed(0)} KB` : 'N/A',
    },
    {
      icon: <MdVideoSettings className="text-sm" />,
      label: 'Quality',
      value: stats ? `Q${stats.jpegQuality}` : 'N/A',
    },
  ]

  const processingStats: StatItem[] = [
    {
      icon: <MdMemory className="text-sm" />,
      label: 'Processing',
      value: stats ? `${stats.avgProcessingMs.toFixed(1)}ms` : 'N/A',
    },
    {
      icon: <MdMotionPhotosOn className="text-sm" />,
      label: 'Motion',
      value: stats && stats.motionProcessingMs !== null ? `${stats.motionProcessingMs.toFixed(1)}ms` : 'N/A',
    },
    {
      icon: <MdVideoSettings className="text-sm" />,
      label: 'Decode',
      value: stats ? `${stats.decodeMs.toFixed(1)}ms` : 'N/A',
    },
    {
      icon: <MdVideoSettings className="text-sm" />,
      label: 'Encode',
      value: stats ? `${stats.encodeMs.toFixed(1)}ms` : 'N/A',
    },
  ]

  const hardwareStats: StatItem[] = [
    {
      icon: <MdVideoSettings className="text-sm" />,
      label: 'Decoder',
      value: stats?.decoderType || 'N/A',
    },
    {
      icon: <MdVideoSettings className="text-sm" />,
      label: 'Encoder',
      value: stats?.encoderType || 'N/A',
    },
    {
      icon: <MdMemory className="text-sm" />,
      label: 'Frame Count',
      value: stats ? stats.frameCount.toLocaleString() : 'N/A',
    },
    {
      icon: <MdSpeed className="text-sm" />,
      label: 'State',
      value: stats?.state || 'Unknown',
    },
  ]

  // Helper to get model display name
  const getModelDisplayName = (model: DetectionModel): string => {
    switch (model) {
      case 'simple_diff': return 'Simple Diff'
      case 'knn': return 'KNN'
      case 'mog2': return 'MOG2'
      default: return model
    }
  }

  // Build motion stats based on detection model
  const getMotionStats = (): StatItem[] => {
    const baseStats: StatItem[] = [
      {
        icon: <MdMotionPhotosOn className="text-sm" />,
        label: 'Detection',
        value: camera.motionDetectionEnabled ? 'Enabled' : 'Disabled',
      },
      {
        icon: <MdVideoSettings className="text-sm" />,
        label: 'Model',
        value: getModelDisplayName(camera.detectionModel),
      },
      {
        icon: <MdVideoSettings className="text-sm" />,
        label: 'Zones',
        value: `${camera.motionZones.length}`,
      },
      {
        icon: <MdVideoSettings className="text-sm" />,
        label: 'Coverage',
        value: camera.motionZones.some((zone) => isFullFrameMotionZone(zone))
          ? 'Includes full frame'
          : 'Custom polygons',
      },
    ]

    const settings = camera.modelSettings

    // Add model-specific stats
    if (camera.detectionModel === 'simple_diff' && 'threshold' in settings) {
      const s = settings as SimpleDiffSettings
      return [
        ...baseStats,
        {
          icon: <MdSpeed className="text-sm" />,
          label: 'Threshold',
          value: `${s.threshold}`,
        },
      ]
    } else if (camera.detectionModel === 'knn' && 'dist2Threshold' in settings) {
      const s = settings as KNNSettings
      return [
        ...baseStats,
        {
          icon: <MdMemory className="text-sm" />,
          label: 'History',
          value: `${s.history}`,
        },
        {
          icon: <MdSpeed className="text-sm" />,
          label: 'Dist Threshold',
          value: `${s.dist2Threshold}`,
        },
      ]
    } else if (camera.detectionModel === 'mog2' && 'varThreshold' in settings) {
      const s = settings as MOG2Settings
      return [
        ...baseStats,
        {
          icon: <MdMemory className="text-sm" />,
          label: 'History',
          value: `${s.history}`,
        },
        {
          icon: <MdSpeed className="text-sm" />,
          label: 'Var Threshold',
          value: `${s.varThreshold}`,
        },
      ]
    }

    return baseStats
  }

  const motionStats = getMotionStats()

  const renderStatGroup = (title: string, items: StatItem[]) => (
    <div className="mb-4 last:mb-0">
      <h3 className="text-xs font-medium text-default-500 mb-2">{title}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item, index) => (
          <div key={index}>
            <div className="flex items-center gap-1 text-xs text-default-600 mb-1">
              {item.icon}
              <span>{item.label}</span>
            </div>
            <div className="text-sm font-medium text-default-400">
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <Card className="mb-4 shadow-md">
      <CardHeader className="pb-2">
        <h2 className="text-base font-volkorn font-semibold">Statistics</h2>
      </CardHeader>
      <CardBody className="pt-2">
        {renderStatGroup('Stream', streamStats)}
        {renderStatGroup('Processing', processingStats)}
        {renderStatGroup('Hardware', hardwareStats)}
        {renderStatGroup('Motion Detection', motionStats)}
      </CardBody>
    </Card>
  )
}
