import assert from 'node:assert/strict'
import test from 'node:test'
import {
  motionZonesSchema,
  type MotionZone,
} from '../db/shared/camera'
import { resolveCreateMotionZones, resolveUpdateMotionZones } from './motionZones'
import { toCameraDto, type RedisCameraEntity } from './serializers'

const polygonZone: MotionZone = {
  id: 'front-door',
  name: 'Front Door',
  points: [
    [10, 20],
    [110, 20],
    [110, 160],
  ],
  minContourArea: 2400,
  thresholdPercent: 3.5,
}

test('create motion zones default to a full-frame zone', () => {
  const zones = resolveCreateMotionZones()

  assert.equal(zones.length, 1)
  assert.equal(zones[0].name, 'Full Frame')
  assert.deepEqual(zones[0].points, [])
})

test('update motion zones use replace-all semantics', () => {
  const existingZones: MotionZone[] = [
    polygonZone,
    {
      id: 'driveway',
      name: 'Driveway',
      points: [
        [150, 40],
        [300, 40],
        [300, 220],
      ],
      minContourArea: 2500,
      thresholdPercent: 2.5,
    },
  ]

  const replacementZones: MotionZone[] = [polygonZone]

  assert.deepEqual(
    resolveUpdateMotionZones(existingZones, replacementZones),
    replacementZones
  )
  assert.deepEqual(resolveUpdateMotionZones(existingZones), existingZones)
})

test('motion zone schema rejects invalid payloads', () => {
  assert.equal(motionZonesSchema.safeParse([]).success, false)

  assert.equal(
    motionZonesSchema.safeParse([
      {
        ...polygonZone,
      },
      {
        ...polygonZone,
        name: 'Duplicate Id',
      },
    ]).success,
    false
  )

  assert.equal(
    motionZonesSchema.safeParse([
      {
        ...polygonZone,
        points: [
          [10, 20],
          [40, 60],
        ],
      },
    ]).success,
    false
  )
})

test('camera serializer parses redis json fields into a dto', () => {
  const camera = {
    externalID: 'camera-1',
    name: 'Front Door Camera',
    building: 'House',
    ipAddress: '192.168.1.25',
    port: 554,
    protocol: 'rtsp',
    username: 'admin',
    password: 'secret',
    streamPath: '/live/ch0',
    expectedSecondsUpdated: 30,
    lastUpdated: new Date('2026-03-21T12:00:00.000Z'),
    targetWidth: 1280,
    targetHeight: 720,
    motionDetectionEnabled: true,
    detectionModel: 'mog2',
    modelSettings: JSON.stringify({
      history: 600,
      varThreshold: 20,
      detectShadows: false,
    }),
    motionZones: JSON.stringify([polygonZone]),
    maxStreamFps: 20,
    maxRecordingFps: 12,
    jpegQuality: 90,
    objectDetectionEnabled: false,
    classConfigs: JSON.stringify([]),
  } satisfies RedisCameraEntity

  const dto = toCameraDto(camera)

  assert.equal(dto.externalID, camera.externalID)
  assert.equal(dto.protocol, 'rtsp')
  assert.equal(dto.lastUpdated, '2026-03-21T12:00:00.000Z')
  assert.deepEqual(dto.motionZones, [polygonZone])
  assert.deepEqual(dto.modelSettings, {
    history: 600,
    varThreshold: 20,
    detectShadows: false,
  })
})
