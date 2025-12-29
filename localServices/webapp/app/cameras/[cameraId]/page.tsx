'use client'

import { useParams, useRouter } from 'next/navigation'
import { useDisclosure } from '@nextui-org/modal'
import { Button } from '@nextui-org/button'
import { useSocketData } from '../../socketData'
import { useCameraStream } from '@/hooks/useCameraStream'
import { CameraHeader } from '../components/CameraHeader'
import { CameraStreamCard } from '../components/CameraStreamCard'
import { CameraStatsCard } from '../components/CameraStatsCard'
import { CameraSettingsModal } from '../components/CameraSettingsModal'

export default function CameraDetail() {
  const params = useParams()
  const router = useRouter()
  const { cameras } = useSocketData()
  const { isOpen, onOpen, onClose } = useDisclosure()

  const cameraId = params.cameraId as string
  const camera = cameras.find((c) => c.externalID === cameraId)

  const { stats, clientFps, isConnected } = useCameraStream({
    cameraId,
    enabled: !!camera,
  })

  if (!camera) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-volkorn font-bold">Camera Not Found</h1>
          <Button color="primary" onPress={() => router.push('/home')}>
            Go Back Home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-8 pb-24">
        <CameraHeader
          cameraName={camera.name}
          buildingName={camera.building}
          isStreaming={isConnected}
          motionDetectionEnabled={camera.motionDetectionEnabled}
          lastUpdated={camera.lastUpdated}
          onSettingsClick={onOpen}
        />

        <CameraStreamCard cameraId={cameraId} />

        <CameraStatsCard
          camera={camera}
          stats={stats}
          clientFps={clientFps}
        />
      </div>

      <CameraSettingsModal
        camera={camera}
        isOpen={isOpen}
        onClose={onClose}
      />
    </>
  )
}
