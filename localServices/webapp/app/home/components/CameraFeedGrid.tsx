'use client'

import { type Camera } from '../../socketData'
import { useCameraStream } from '@/hooks/useCameraStream'

interface CameraFeedGridProps {
  cameras: Camera[]
  onCameraClick?: (cameraId: string) => void
}

interface CameraFeedItemProps {
  camera: Camera
  onClick?: () => void
}

function CameraFeedItem({ camera, onClick }: CameraFeedItemProps) {
  const { frame, stats, clientFps } = useCameraStream({ cameraId: camera.externalID })

  return (
    <div
      className="relative aspect-video bg-default-100 rounded-md overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      {frame ? (
        <img
          src={`data:image/jpeg;base64,${frame}`}
          alt={camera.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex items-center justify-center h-full text-default-400 text-xs">
          Loading...
        </div>
      )}
      {/* Top overlay - stats */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-1">
        {/* Live indicator with FPS */}
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${
          frame ? 'bg-red-600/90 text-white' : 'bg-default-300/90 text-default-600'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${frame ? 'bg-white animate-pulse' : 'bg-default-400'}`} />
          {clientFps > 0 ? `${clientFps.toFixed(0)} FPS` : (frame ? 'LIVE' : 'OFF')}
        </div>
        {/* Processing times */}
        {stats && (
          <div className="bg-black/60 text-white px-1.5 py-0.5 rounded text-[9px] flex items-center gap-1">
            <span>{stats.avgProcessingMs.toFixed(0)}ms</span>
            {stats.motionProcessingMs !== null && (
              <span className="text-blue-300">+{stats.motionProcessingMs.toFixed(0)}ms</span>
            )}
          </div>
        )}
      </div>
      {/* Bottom overlay - name and quality */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
        <div className="flex justify-between items-center">
          <span className="text-white text-[10px] font-medium">{camera.name}</span>
          {stats && (
            <span className="text-white/80 text-[9px]">
              Q{stats.jpegQuality}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function CameraFeedGrid({ cameras, onCameraClick }: CameraFeedGridProps) {
  if (cameras.length === 0) return null

  return (
    <div className="mb-4">
      <h4 className="text-xs font-medium text-default-500 mb-2">Cameras</h4>
      <div className="grid grid-cols-2 gap-2">
        {cameras.map(camera => (
          <CameraFeedItem
            key={camera.externalID}
            camera={camera}
            onClick={() => onCameraClick?.(camera.externalID)}
          />
        ))}
      </div>
    </div>
  )
}
