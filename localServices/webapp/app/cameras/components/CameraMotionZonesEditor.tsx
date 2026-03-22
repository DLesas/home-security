'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import { Button } from '@nextui-org/button'
import { Card, CardBody, CardHeader } from '@nextui-org/card'
import { Input } from '@nextui-org/input'
import toast from 'react-hot-toast'
import {
  isFullFrameMotionZone,
  motionZonesSchema,
  type MotionZone,
} from '@/shared/camera'
import { useUpdateCameraMutation } from '@/hooks/mutations/useCameraMutations'
import type { Camera } from '../../socketData'
import { MotionZoneSvgOverlay } from './MotionZoneSvgOverlay'
import {
  clampPointToImage,
  clientPointToImagePoint,
  defaultPolygonPoints,
  describeMotionZone,
  getContainedImageRect,
  insertVertexOnEdge,
  removeVertexAt,
  type Size,
  type ViewportRect,
} from './motionZoneUtils'

interface CameraMotionZonesEditorProps {
  camera: Camera
  frame: string | null
}

function createZoneId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `zone-${Date.now()}`
}

function cloneZones(zones: MotionZone[]): MotionZone[] {
  return zones.map((zone) => ({
    ...zone,
    points: zone.points.map(([x, y]) => [x, y]),
  }))
}

function zonesSignature(zones: MotionZone[]): string {
  return JSON.stringify(zones)
}

function useContainerViewport(ref: RefObject<HTMLDivElement | null>): ViewportRect | null {
  const [viewport, setViewport] = useState<ViewportRect | null>(null)

  useEffect(() => {
    const updateViewport = () => {
      if (!ref.current) {
        return
      }

      const rect = ref.current.getBoundingClientRect()
      setViewport({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      })
    }

    updateViewport()

    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateViewport)
      return () => window.removeEventListener('resize', updateViewport)
    }

    const observer = new ResizeObserver(() => updateViewport())
    observer.observe(element)
    window.addEventListener('resize', updateViewport)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateViewport)
    }
  }, [ref])

  return viewport
}

export function CameraMotionZonesEditor({
  camera,
  frame,
}: CameraMotionZonesEditorProps) {
  const updateCamera = useUpdateCameraMutation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [imageSize, setImageSize] = useState<Size>({ width: 0, height: 0 })
  const [snapshotFrame, setSnapshotFrame] = useState<string | null>(null)
  const [baselineZones, setBaselineZones] = useState<MotionZone[]>(
    cloneZones(camera.motionZones)
  )
  const [zones, setZones] = useState<MotionZone[]>(cloneZones(camera.motionZones))
  const [selectedZoneId, setSelectedZoneId] = useState<string | undefined>(
    camera.motionZones[0]?.id
  )
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null)
  const [draggingVertex, setDraggingVertex] = useState<{
    zoneId: string
    vertexIndex: number
  } | null>(null)

  const baselineSignature = zonesSignature(baselineZones)
  const currentSignature = zonesSignature(zones)
  const isDirty = currentSignature !== baselineSignature

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) ?? zones[0],
    [selectedZoneId, zones]
  )

  const viewport = useContainerViewport(containerRef)
  const displayRect = useMemo(
    () =>
      viewport
        ? getContainedImageRect(
            { width: viewport.width, height: viewport.height },
            imageSize
          )
        : { x: 0, y: 0, width: 0, height: 0 },
    [imageSize, viewport]
  )

  const validationMessage = useMemo(() => {
    const result = motionZonesSchema.safeParse(zones)
    if (result.success) {
      return null
    }

    return result.error.issues[0]?.message ?? 'Motion zones are invalid'
  }, [zones])

  useEffect(() => {
    setSnapshotFrame(null)
    setImageSize({ width: 0, height: 0 })
  }, [camera.externalID])

  useEffect(() => {
    if (frame && !snapshotFrame) {
      setSnapshotFrame(frame)
    }
  }, [frame, snapshotFrame])

  useEffect(() => {
    setBaselineZones(cloneZones(camera.motionZones))
    setZones(cloneZones(camera.motionZones))
    setSelectedZoneId(camera.motionZones[0]?.id)
    setSelectedVertexIndex(null)
    setDraggingVertex(null)
  }, [camera.externalID])

  useEffect(() => {
    const incomingSignature = zonesSignature(camera.motionZones)
    if (!isDirty && incomingSignature !== baselineSignature) {
      setBaselineZones(cloneZones(camera.motionZones))
      setZones(cloneZones(camera.motionZones))
      setSelectedZoneId((currentId) =>
        camera.motionZones.some((zone) => zone.id === currentId)
          ? currentId
          : camera.motionZones[0]?.id
      )
    }
  }, [baselineSignature, camera.motionZones, isDirty])

  useEffect(() => {
    if (!selectedZone && zones.length > 0) {
      setSelectedZoneId(zones[0].id)
    }
  }, [selectedZone, zones])

  useEffect(() => {
    setSelectedVertexIndex(null)
  }, [selectedZoneId])

  useEffect(() => {
    if (!draggingVertex || !containerRef.current || imageSize.width <= 0 || imageSize.height <= 0) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const point = clientPointToImagePoint(
        event.clientX,
        event.clientY,
        containerRef.current!.getBoundingClientRect(),
        imageSize
      )

      if (!point) {
        return
      }

      setZones((currentZones) =>
        currentZones.map((zone) => {
          if (zone.id !== draggingVertex.zoneId) {
            return zone
          }

          return {
            ...zone,
            points: zone.points.map((existingPoint, index) =>
              index === draggingVertex.vertexIndex
                ? clampPointToImage(point, imageSize)
                : existingPoint
            ),
          }
        })
      )
    }

    const handlePointerUp = () => {
      setDraggingVertex(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [draggingVertex, imageSize])

  const updateSelectedZone = useCallback((updater: (zone: MotionZone) => MotionZone) => {
    if (!selectedZone) {
      return
    }

    setZones((currentZones) =>
      currentZones.map((zone) => (zone.id === selectedZone.id ? updater(zone) : zone))
    )
  }, [selectedZone])

  const addZone = (fullFrame: boolean) => {
    if (!fullFrame) {
      if (imageSize.width <= 0 || imageSize.height <= 0) {
        toast.error('Wait for the snapshot to load before adding a polygon zone.')
        return
      }
    }

    const newZone: MotionZone = {
      id: createZoneId(),
      name: `Zone ${zones.length + 1}`,
      points: fullFrame ? [] : defaultPolygonPoints(imageSize),
      minContourArea: 2500,
      thresholdPercent: 2.5,
    }

    setZones((currentZones) => [...currentZones, newZone])
    setSelectedZoneId(newZone.id)
    setSelectedVertexIndex(null)
  }

  const handleEdgeInsert = (zoneId: string, edgeStartIndex: number) => {
    let newSelectedIndex: number | null = null
    setZones((currentZones) =>
      currentZones.map((zone) => {
        if (zone.id !== zoneId || isFullFrameMotionZone(zone)) {
          return zone
        }
        const n = zone.points.length
        if (n < 3) {
          return zone
        }
        const nextPoints = insertVertexOnEdge(zone.points, edgeStartIndex)
        const insertAt = edgeStartIndex === n - 1 ? n : edgeStartIndex + 1
        if (zoneId === selectedZoneId) {
          newSelectedIndex = insertAt
        }
        return { ...zone, points: nextPoints }
      })
    )
    if (newSelectedIndex !== null) {
      setSelectedVertexIndex(newSelectedIndex)
    }
  }

  const removeSelectedNotch = () => {
    if (!selectedZone || selectedVertexIndex === null || isFullFrameMotionZone(selectedZone)) {
      return
    }

    const next = removeVertexAt(selectedZone.points, selectedVertexIndex)
    if (!next) {
      toast.error('A polygon needs at least three corners.')
      return
    }

    setZones((currentZones) =>
      currentZones.map((zone) =>
        zone.id === selectedZone.id ? { ...zone, points: next } : zone
      )
    )
    setSelectedVertexIndex(null)
  }

  const handleDeleteSelectedZone = () => {
    if (!selectedZone) {
      return
    }

    if (zones.length === 1) {
      toast.error('Each camera needs at least one motion zone')
      return
    }

    setZones((currentZones) =>
      currentZones.filter((zone) => zone.id !== selectedZone.id)
    )
    setSelectedZoneId((currentId) =>
      currentId === selectedZone.id
        ? zones.find((zone) => zone.id !== selectedZone.id)?.id
        : currentId
    )
    setSelectedVertexIndex(null)
  }

  const handleSave = async () => {
    const validation = motionZonesSchema.safeParse(zones)
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? 'Motion zones are invalid')
      return
    }

    try {
      await updateCamera.mutateAsync({
        cameraId: camera.externalID,
        updates: {
          motionZones: validation.data,
        },
      })

      setBaselineZones(cloneZones(validation.data))
      setZones(cloneZones(validation.data))
      setSelectedVertexIndex(null)
      toast.success('Motion zones updated')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update motion zones'
      )
    }
  }

  const handleReset = () => {
    setZones(cloneZones(baselineZones))
    setSelectedZoneId(baselineZones[0]?.id)
    setSelectedVertexIndex(null)
    setDraggingVertex(null)
  }

  const onVertexPointerDown = (
    zoneId: string,
    vertexIndex: number,
    _event: ReactPointerEvent<SVGGElement>
  ) => {
    setSelectedZoneId(zoneId)
    setSelectedVertexIndex(vertexIndex)
    setDraggingVertex({ zoneId, vertexIndex })
  }

  const polygonNotchCount =
    selectedZone && !isFullFrameMotionZone(selectedZone)
      ? selectedZone.points.length
      : 0

  const actionBar = (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      <Button
        className="min-h-11 w-full sm:w-auto"
        variant="flat"
        onPress={() => frame && setSnapshotFrame(frame)}
        isDisabled={!frame}
      >
        Refresh snapshot
      </Button>
      <Button
        className="min-h-11 w-full sm:w-auto"
        variant="flat"
        onPress={handleReset}
        isDisabled={!isDirty}
      >
        Reset
      </Button>
      <Button
        className="min-h-11 w-full sm:w-auto"
        color="primary"
        onPress={handleSave}
        isDisabled={!isDirty || !!validationMessage}
        isLoading={updateCamera.isPending}
      >
        Save zones
      </Button>
    </div>
  )

  return (
    <Card className="mb-4 shadow-md">
      <CardHeader className="flex flex-col gap-3 border-b border-default-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-volkorn font-semibold leading-tight">Motion zones</h2>
          <p className="text-sm text-default-500">
            Drag the <span className="font-medium text-default-700">diamond notches</span> to move
            corners. Tap the <span className="font-medium text-default-700">+ on an edge</span> to add a
            notch, or remove the selected notch below.
          </p>
        </div>
        <div className="hidden w-full sm:block sm:w-auto">{actionBar}</div>
      </CardHeader>

      <CardBody className="flex flex-col gap-4 pb-28 sm:pb-4">
        <div
          ref={containerRef}
          className={`relative aspect-video w-full max-w-full overflow-hidden rounded-xl bg-black ${
            draggingVertex ? 'touch-none' : 'touch-pan-y'
          }`}
        >
          {snapshotFrame ? (
            <>
              <img
                src={`data:image/jpeg;base64,${snapshotFrame}`}
                alt="Frozen camera snapshot for motion zone editing"
                className="h-full w-full object-contain select-none"
                draggable={false}
                onLoad={(event) => {
                  setImageSize({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  })
                }}
              />

              {displayRect.width > 0 && displayRect.height > 0 ? (
                <div
                  className="absolute"
                  style={{
                    left: displayRect.x,
                    top: displayRect.y,
                    width: displayRect.width,
                    height: displayRect.height,
                  }}
                >
                  <MotionZoneSvgOverlay
                    zones={zones}
                    imageSize={imageSize}
                    selectedZoneId={selectedZone?.id}
                    showVertexNotches
                    showEdgeInserts
                    showLabels
                    selectedVertexIndex={selectedVertexIndex}
                    className="h-full w-full"
                    onZoneSelect={(zoneId) => {
                      setSelectedZoneId(zoneId)
                    }}
                    onVertexPointerDown={onVertexPointerDown}
                    onEdgeInsertPointerDown={(zoneId, edgeIdx, e) => {
                      e.stopPropagation()
                      handleEdgeInsert(zoneId, edgeIdx)
                    }}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex h-full min-h-[12rem] items-center justify-center px-4 text-center text-sm text-default-400">
              Open this page while the stream is running — a snapshot loads automatically. You can also
              tap Refresh snapshot after frames arrive.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-default-200 bg-default-50 p-3 text-sm text-default-600">
          <p>
            Zones are stored in <span className="font-medium text-default-800">camera image pixels</span>.
            If you change resolution later, adjust the mask here.
          </p>
        </div>

        {validationMessage ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {validationMessage}
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-default-500">Zones</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            {zones.map((zone) => {
              const isSelected = zone.id === selectedZone?.id

              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => {
                    setSelectedZoneId(zone.id)
                  }}
                  className={`min-h-11 shrink-0 snap-start rounded-full border px-4 py-2 text-left text-sm transition ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-default-200 bg-default-100/80 text-default-700'
                  }`}
                >
                  <div className="font-medium">{zone.name}</div>
                  <div className="text-xs text-default-500">{describeMotionZone(zone)}</div>
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              className="min-h-11 flex-1 sm:flex-none"
              variant="flat"
              onPress={() => addZone(false)}
            >
              Add polygon zone
            </Button>
            <Button
              className="min-h-11 flex-1 sm:flex-none"
              variant="flat"
              onPress={() => addZone(true)}
            >
              Add full frame zone
            </Button>
          </div>
        </div>

        {selectedZone ? (
          <div className="space-y-3 rounded-xl border border-default-200 p-4">
            <Input
              label="Zone name"
              size="lg"
              value={selectedZone.name}
              onValueChange={(value) =>
                updateSelectedZone((zone) => ({
                  ...zone,
                  name: value,
                }))
              }
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Minimum contour area"
                size="lg"
                type="number"
                inputMode="numeric"
                value={selectedZone.minContourArea.toString()}
                onChange={(event) =>
                  updateSelectedZone((zone) => ({
                    ...zone,
                    minContourArea: Number(event.target.value) || 1,
                  }))
                }
                description="Ignores tiny motion blobs."
              />

              <Input
                label="Threshold %"
                size="lg"
                type="number"
                inputMode="decimal"
                value={selectedZone.thresholdPercent.toString()}
                onChange={(event) =>
                  updateSelectedZone((zone) => ({
                    ...zone,
                    thresholdPercent: Number(event.target.value) || 0,
                  }))
                }
                description="Share of the zone that must move."
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                className="min-h-11 w-full sm:w-auto"
                size="lg"
                variant="flat"
                onPress={() => {
                  updateSelectedZone((zone) => ({
                    ...zone,
                    points: [],
                  }))
                  setSelectedVertexIndex(null)
                }}
              >
                Use full frame
              </Button>

              {!isFullFrameMotionZone(selectedZone) && imageSize.width > 0 && imageSize.height > 0 ? (
                <Button
                  className="min-h-11 w-full sm:w-auto"
                  size="lg"
                  variant="flat"
                  onPress={() =>
                    updateSelectedZone((zone) => ({
                      ...zone,
                      points: defaultPolygonPoints(imageSize),
                    }))
                  }
                >
                  Reset polygon shape
                </Button>
              ) : null}

              {!isFullFrameMotionZone(selectedZone) ? (
                <Button
                  className="min-h-11 w-full sm:w-auto"
                  size="lg"
                  variant="flat"
                  color="warning"
                  onPress={removeSelectedNotch}
                  isDisabled={selectedVertexIndex === null || selectedZone.points.length <= 3}
                >
                  Remove selected notch
                </Button>
              ) : null}

              <Button
                className="min-h-11 w-full sm:w-auto"
                size="lg"
                color="danger"
                variant="light"
                onPress={handleDeleteSelectedZone}
              >
                Delete zone
              </Button>
            </div>

            <div className="rounded-xl bg-default-50 p-3 text-sm text-default-600">
              <p className="font-medium text-default-800">
                {isFullFrameMotionZone(selectedZone)
                  ? 'This zone covers the full frame.'
                  : `${polygonNotchCount} notch${polygonNotchCount === 1 ? '' : 'es'} in this polygon.`}
              </p>
              {!isFullFrameMotionZone(selectedZone) ? (
                <p className="mt-1 text-default-600">
                  Tap a diamond to select it (gold ring), then use Remove selected notch, or tap a + on an
                  edge to split it.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardBody>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-default-200 bg-background/95 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md sm:hidden">
        {actionBar}
      </div>
    </Card>
  )
}
