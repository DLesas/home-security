'use client'

import type { PointerEvent as ReactPointerEvent } from 'react'
import type { MotionZone } from '@/shared/camera'
import { isFullFrameMotionZone } from '@/shared/camera'
import {
  edgeInsertRadiusForImage,
  vertexRadiusForImage,
  type Size,
} from './motionZoneUtils'

interface MotionZoneSvgOverlayProps {
  zones: MotionZone[]
  imageSize: Size
  selectedZoneId?: string
  /** Draggable corner notches (diamonds) for the selected polygon zone. */
  showVertexNotches?: boolean
  /** Mid-edge controls to insert a new vertex on that edge. */
  showEdgeInserts?: boolean
  showLabels?: boolean
  /** Highlight the active notch (e.g. for delete). */
  selectedVertexIndex?: number | null
  onZoneSelect?: (zoneId: string) => void
  onVertexPointerDown?: (
    zoneId: string,
    vertexIndex: number,
    event: ReactPointerEvent<SVGGElement>
  ) => void
  onEdgeInsertPointerDown?: (
    zoneId: string,
    edgeStartIndex: number,
    event: ReactPointerEvent<SVGGElement>
  ) => void
  className?: string
}

function DiamondNotch({
  x,
  y,
  r,
  fill,
  stroke,
  strokeWidth,
  selected,
}: {
  x: number
  y: number
  r: number
  fill: string
  stroke: string
  strokeWidth: number
  selected?: boolean
}) {
  return (
    <g transform={`translate(${x},${y})`}>
      <polygon
        points={`0,-${r} ${r},0 0,${r} -${r},0`}
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? strokeWidth + 1 : strokeWidth}
        strokeLinejoin="round"
      />
    </g>
  )
}

function EdgeInsertHandle({
  x,
  y,
  r,
  onPointerDown,
}: {
  x: number
  y: number
  r: number
  onPointerDown: (e: ReactPointerEvent<SVGGElement>) => void
}) {
  const arm = r * 0.45
  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ cursor: 'pointer', touchAction: 'none' }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onPointerDown(e)
      }}
    >
      <circle r={r * 1.15} fill="rgba(15,23,42,0.55)" stroke="#94a3b8" strokeWidth={1.5} />
      <line x1={-arm} y1={0} x2={arm} y2={0} stroke="#e2e8f0" strokeWidth={2} strokeLinecap="round" />
      <line x1={0} y1={-arm} x2={0} y2={arm} stroke="#e2e8f0" strokeWidth={2} strokeLinecap="round" />
    </g>
  )
}

export function MotionZoneSvgOverlay({
  zones,
  imageSize,
  selectedZoneId,
  showVertexNotches = false,
  showEdgeInserts = false,
  showLabels = false,
  selectedVertexIndex = null,
  onZoneSelect,
  onVertexPointerDown,
  onEdgeInsertPointerDown,
  className,
}: MotionZoneSvgOverlayProps) {
  if (imageSize.width <= 0 || imageSize.height <= 0) {
    return null
  }

  const vertexR = vertexRadiusForImage(imageSize)
  const edgeR = edgeInsertRadiusForImage(imageSize)

  return (
    <svg
      viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
      className={className}
      style={{ touchAction: 'none' }}
      role="img"
      aria-hidden
    >
      {zones.map((zone) => {
        const isSelected = zone.id === selectedZoneId
        const stroke = isSelected ? '#38bdf8' : '#f8fafc'
        const fill = isSelected ? 'rgba(56, 189, 248, 0.14)' : 'rgba(248, 250, 252, 0.06)'
        const firstPoint = zone.points[0]
        const isPolygon = !isFullFrameMotionZone(zone) && zone.points.length >= 3
        const showThisZoneNotches =
          showVertexNotches && isSelected && isPolygon
        const showThisEdges =
          showEdgeInserts && isSelected && isPolygon && onEdgeInsertPointerDown

        return (
          <g
            key={zone.id}
            onPointerDown={(event) => {
              event.stopPropagation()
              onZoneSelect?.(zone.id)
            }}
            className="cursor-pointer"
          >
            {isFullFrameMotionZone(zone) ? (
              <rect
                x={2}
                y={2}
                width={Math.max(imageSize.width - 4, 0)}
                height={Math.max(imageSize.height - 4, 0)}
                stroke={stroke}
                strokeWidth={isSelected ? 3 : 2}
                strokeDasharray="12 8"
                fill={fill}
                rx={8}
              />
            ) : (
              <polygon
                points={zone.points.map(([x, y]) => `${x},${y}`).join(' ')}
                stroke={stroke}
                strokeWidth={isSelected ? 3 : 2}
                fill={fill}
                strokeLinejoin="round"
              />
            )}

            {showLabels && firstPoint ? (
              <text
                x={firstPoint[0] + 8}
                y={firstPoint[1] - 8}
                fill={stroke}
                fontSize={Math.max(14, Math.round(imageSize.height * 0.022))}
                fontWeight={600}
                stroke="rgba(0,0,0,0.45)"
                strokeWidth={0.6}
                paintOrder="stroke"
                style={{ pointerEvents: 'none' }}
              >
                {zone.name}
              </text>
            ) : null}

            {showThisEdges
              ? Array.from({ length: zone.points.length }, (_, edgeStartIndex) => {
                  const n = zone.points.length
                  const a = zone.points[edgeStartIndex]
                  const b = zone.points[(edgeStartIndex + 1) % n]
                  const mx = (a[0] + b[0]) / 2
                  const my = (a[1] + b[1]) / 2
                  return (
                    <EdgeInsertHandle
                      key={`edge-${zone.id}-${edgeStartIndex}`}
                      x={mx}
                      y={my}
                      r={edgeR}
                      onPointerDown={(e) => onEdgeInsertPointerDown?.(zone.id, edgeStartIndex, e)}
                    />
                  )
                })
              : null}

            {showThisZoneNotches
              ? zone.points.map(([x, y], index) => {
                  const selected = selectedVertexIndex === index
                  return (
                    <g
                      key={`${zone.id}-notch-${index}`}
                      style={{ cursor: 'grab', touchAction: 'none' }}
                      onPointerDown={(event) => {
                        event.stopPropagation()
                        event.currentTarget.setPointerCapture(event.pointerId)
                        onVertexPointerDown?.(zone.id, index, event)
                      }}
                    >
                      <DiamondNotch
                        x={x}
                        y={y}
                        r={vertexR}
                        fill="#0f172a"
                        stroke="#38bdf8"
                        strokeWidth={3}
                        selected={selected}
                      />
                      {selected ? (
                        <circle
                          cx={x}
                          cy={y}
                          r={vertexR + 6}
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth={2}
                          style={{ pointerEvents: 'none' }}
                        />
                      ) : null}
                    </g>
                  )
                })
              : null}
          </g>
        )
      })}
    </svg>
  )
}
