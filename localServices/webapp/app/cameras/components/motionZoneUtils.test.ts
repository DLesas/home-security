import assert from 'node:assert/strict'
import test from 'node:test'
import type { MotionZone } from '@/shared/camera'
import {
  clientPointToImagePoint,
  defaultPolygonPoints,
  describeMotionZone,
  getContainedImageRect,
  insertVertexOnEdge,
  removeVertexAt,
  vertexRadiusForImage,
  viewportPointToImagePoint,
} from './motionZoneUtils'

const polygonZone: MotionZone = {
  id: 'front-door',
  name: 'Front Door',
  points: [
    [10, 10],
    [110, 10],
    [110, 150],
  ],
  minContourArea: 2500,
  thresholdPercent: 2.5,
}

test('getContainedImageRect centers portrait content in a landscape viewport', () => {
  const rect = getContainedImageRect(
    { width: 1280, height: 720 },
    { width: 720, height: 1280 }
  )

  assert.equal(rect.height, 720)
  assert.equal(rect.width, 405)
  assert.equal(rect.x, 437.5)
  assert.equal(rect.y, 0)
})

test('viewportPointToImagePoint maps displayed coordinates back to image pixels', () => {
  const point = viewportPointToImagePoint(
    640,
    360,
    { left: 0, top: 0, width: 1280, height: 720 },
    { width: 1920, height: 1080 }
  )

  assert.deepEqual(point, [960, 540])
})

test('clientPointToImagePoint matches viewport mapping with a DOMRect', () => {
  const domRect = {
    left: 100,
    top: 200,
    width: 1280,
    height: 720,
    right: 1380,
    bottom: 920,
    x: 100,
    y: 200,
    toJSON() {
      return {}
    },
  } as DOMRect

  const a = clientPointToImagePoint(740, 560, domRect, { width: 1920, height: 1080 })
  const b = viewportPointToImagePoint(
    740,
    560,
    { left: 100, top: 200, width: 1280, height: 720 },
    { width: 1920, height: 1080 }
  )

  assert.deepEqual(a, b)
})

test('vertexRadiusForImage scales with resolution and stays within bounds', () => {
  assert.equal(vertexRadiusForImage({ width: 0, height: 0 }), 16)
  assert.ok(vertexRadiusForImage({ width: 4000, height: 3000 }) <= 48)
  assert.ok(vertexRadiusForImage({ width: 640, height: 480 }) >= 14)
})

test('insertVertexOnEdge inserts midpoint on each edge including closing edge', () => {
  const square = defaultPolygonPoints({ width: 100, height: 100 })
  assert.equal(square.length, 4)
  const withMid = insertVertexOnEdge(square, 0)
  assert.equal(withMid.length, 5)
  assert.deepEqual(withMid[1], [50, 15])
  const closed = insertVertexOnEdge(square, 3)
  assert.equal(closed.length, 5)
  assert.deepEqual(closed[4], [15, 50])
})

test('removeVertexAt refuses to go below three vertices', () => {
  const tri: [number, number][] = [
    [0, 0],
    [10, 0],
    [5, 10],
  ]
  const quad: [number, number][] = [...tri, [0, 10]]
  assert.equal(removeVertexAt(tri, 0), null)
  assert.equal(removeVertexAt(quad, 3)?.length, 3)
})

test('viewportPointToImagePoint returns null outside the contained image bounds', () => {
  const point = viewportPointToImagePoint(
    100,
    10,
    { left: 0, top: 0, width: 1280, height: 720 },
    { width: 720, height: 1280 }
  )

  assert.equal(point, null)
})

test('describeMotionZone summarizes full-frame and polygon zones', () => {
  assert.equal(
    describeMotionZone({
      ...polygonZone,
      points: [],
    }),
    'Full frame'
  )

  assert.equal(describeMotionZone(polygonZone), '3 points')
})
