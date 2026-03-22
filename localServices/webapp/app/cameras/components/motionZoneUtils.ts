import type { MotionZone, MotionZonePoint } from '@/shared/camera'

export interface Size {
  width: number
  height: number
}

export interface ViewportRect extends Size {
  left: number
  top: number
}

export interface ContainedImageRect extends Size {
  x: number
  y: number
}

export function getContainedImageRect(
  container: Size,
  image: Size
): ContainedImageRect {
  if (
    container.width <= 0 ||
    container.height <= 0 ||
    image.width <= 0 ||
    image.height <= 0
  ) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  const containerAspect = container.width / container.height
  const imageAspect = image.width / image.height

  if (imageAspect > containerAspect) {
    const width = container.width
    const height = width / imageAspect
    return {
      x: 0,
      y: (container.height - height) / 2,
      width,
      height,
    }
  }

  const height = container.height
  const width = height * imageAspect
  return {
    x: (container.width - width) / 2,
    y: 0,
    width,
    height,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function clampPointToImage(
  point: MotionZonePoint,
  image: Size
): MotionZonePoint {
  return [
    clamp(point[0], 0, Math.max(image.width - 1, 0)),
    clamp(point[1], 0, Math.max(image.height - 1, 0)),
  ]
}

/**
 * Maps a screen point to image pixel coordinates.
 * Always pass a **fresh** container rect from `element.getBoundingClientRect()` so
 * coordinates stay correct after scroll, pinch-zoom, or dynamic layout changes.
 */
export function viewportPointToImagePoint(
  clientX: number,
  clientY: number,
  viewport: ViewportRect,
  image: Size
): MotionZonePoint | null {
  const displayRect = getContainedImageRect(viewport, image)

  if (displayRect.width <= 0 || displayRect.height <= 0) {
    return null
  }

  const offsetX = clientX - viewport.left - displayRect.x
  const offsetY = clientY - viewport.top - displayRect.y

  if (
    offsetX < 0 ||
    offsetY < 0 ||
    offsetX > displayRect.width ||
    offsetY > displayRect.height
  ) {
    return null
  }

  return clampPointToImage(
    [
      Math.round((offsetX / displayRect.width) * image.width),
      Math.round((offsetY / displayRect.height) * image.height),
    ],
    image
  )
}

/** Convenience: convert using a live DOMRect from the editor container. */
export function clientPointToImagePoint(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  image: Size
): MotionZonePoint | null {
  return viewportPointToImagePoint(clientX, clientY, {
    left: containerRect.left,
    top: containerRect.top,
    width: containerRect.width,
    height: containerRect.height,
  }, image)
}

/** Vertex radius in **image** space — scales with resolution but stays tappable on small screens. */
export function vertexRadiusForImage(image: Size): number {
  const minSide = Math.min(image.width, image.height)
  if (minSide <= 0) {
    return 16
  }
  // ~1.4% of shorter side, clamped for touch (maps to several CSS px when letterboxed)
  return Math.round(Math.max(14, Math.min(48, minSide * 0.014)))
}

/** Mid-edge “add notch” handles — slightly smaller than vertex notches. */
export function edgeInsertRadiusForImage(image: Size): number {
  return Math.round(vertexRadiusForImage(image) * 0.55)
}

/** Default axis-aligned rectangle (15% inset) in image pixel space. */
export function defaultPolygonPoints(image: Size): MotionZonePoint[] {
  const w = image.width
  const h = image.height
  if (w <= 0 || h <= 0) {
    return [
      [100, 100],
      [300, 100],
      [300, 300],
      [100, 300],
    ]
  }
  const mx = Math.round(w * 0.15)
  const my = Math.round(h * 0.15)
  const maxX = Math.round(w * 0.85)
  const maxY = Math.round(h * 0.85)
  return [
    [mx, my],
    [maxX, my],
    [maxX, maxY],
    [mx, maxY],
  ]
}

/**
 * Insert a vertex at the midpoint of the edge that starts at `edgeStartIndex`
 * (connecting vertex `edgeStartIndex` to `(edgeStartIndex + 1) % n`).
 */
export function insertVertexOnEdge(
  points: MotionZonePoint[],
  edgeStartIndex: number
): MotionZonePoint[] {
  const n = points.length
  if (n < 3 || edgeStartIndex < 0 || edgeStartIndex >= n) {
    return points
  }
  const next = (edgeStartIndex + 1) % n
  const a = points[edgeStartIndex]
  const b = points[next]
  const mid: MotionZonePoint = [
    Math.round((a[0] + b[0]) / 2),
    Math.round((a[1] + b[1]) / 2),
  ]
  const copy = [...points]
  const insertAt = edgeStartIndex === n - 1 ? n : edgeStartIndex + 1
  copy.splice(insertAt, 0, mid)
  return copy
}

/** Remove one vertex; returns null if that would leave fewer than 3 vertices. */
export function removeVertexAt(
  points: MotionZonePoint[],
  index: number
): MotionZonePoint[] | null {
  const n = points.length
  if (n <= 3 || index < 0 || index >= n) {
    return null
  }
  return points.filter((_, i) => i !== index)
}

export function isPolygonZone(zone: MotionZone): boolean {
  return zone.points.length >= 3
}

export function describeMotionZone(zone: MotionZone): string {
  if (zone.points.length === 0) {
    return 'Full frame'
  }

  if (zone.points.length < 3) {
    return `${zone.points.length} points (incomplete)`
  }

  return `${zone.points.length} points`
}
