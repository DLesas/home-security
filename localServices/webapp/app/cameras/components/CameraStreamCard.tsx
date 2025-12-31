'use client'

import { useState } from 'react'
import { Card } from '@nextui-org/card'
import { Toggle } from '@/components/Toggle'
import { useCameraStream, type CameraStats } from '@/hooks/useCameraStream'

interface CameraStreamCardProps {
  cameraId: string
  onStatsUpdate?: (stats: CameraStats | null) => void
}

export function CameraStreamCard({ cameraId }: CameraStreamCardProps) {
  const { frame, stats, clientFps, motionMask } = useCameraStream({ cameraId })
  const [showMask, setShowMask] = useState(true)

  return (
    <Card className="mb-4 shadow-md overflow-hidden">
      <div className="relative aspect-video bg-black">
        {frame ? (
          <>
            <img
              src={`data:image/jpeg;base64,${frame}`}
              alt="Camera feed"
              className="w-full h-full object-contain"
            />
            {/* Motion mask overlay - red tinted */}
            {showMask && motionMask && (
              <img
                src={`data:image/jpeg;base64,${motionMask}`}
                alt="Motion mask"
                className="absolute inset-0 w-full h-full object-contain mix-blend-multiply opacity-40"
                style={{
                  filter: 'sepia(1) saturate(10000%) hue-rotate(0deg)',
                }}
              />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-default-400 text-sm">
            Connecting to stream...
          </div>
        )}

        {/* Top overlay - FPS and status */}
        <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-2">
          {/* Live indicator with FPS */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
            frame ? 'bg-red-600/90 text-white' : 'bg-default-300/90 text-default-600'
          }`}>
            <span className={`w-2 h-2 rounded-full ${frame ? 'bg-white animate-pulse' : 'bg-default-400'}`} />
            {clientFps > 0 ? `${clientFps.toFixed(0)} FPS` : (frame ? 'LIVE' : 'OFF')}
          </div>

          <div className="flex items-center gap-2">
            {/* Motion mask toggle */}
            <div className="bg-black/60 text-white px-2 py-1 rounded text-xs flex items-center gap-2">
              <Toggle
                size="sm"
                isSelected={showMask}
                onChange={setShowMask}
                label="Motion Mask"
              />
            </div>

            {/* Processing time badge */}
            {stats && (
              <div className="bg-black/60 text-white px-2 py-1 rounded text-xs flex items-center gap-2">
                <span>{stats.avgProcessingMs.toFixed(0)}ms</span>
                {stats.motionProcessingMs !== null && (
                  <span className="text-blue-300">+{stats.motionProcessingMs.toFixed(0)}ms</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom overlay - decoder/encoder info */}
        {stats && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <div className="flex justify-between items-center text-white text-xs">
              <div className="flex items-center gap-2">
                <span className="opacity-70">Decode:</span>
                <span>{stats.decoderType}</span>
                <span className="opacity-50">({stats.decodeMs.toFixed(0)}ms)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="opacity-70">Encode:</span>
                <span>{stats.encoderType}</span>
                <span className="opacity-50">({stats.encodeMs.toFixed(0)}ms)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
