import type { MotionZone } from '../db/shared/camera'
import { makeID } from '../utils/index'

export const createDefaultMotionZone = (): MotionZone => ({
  id: makeID(),
  name: 'Full Frame',
  points: [],
  minContourArea: 2500,
  thresholdPercent: 2.5,
})

export function resolveCreateMotionZones(
  motionZones?: MotionZone[]
): MotionZone[] {
  if (motionZones && motionZones.length > 0) {
    return motionZones
  }

  return [createDefaultMotionZone()]
}

export function resolveUpdateMotionZones(
  existingZones: MotionZone[],
  updatedZones?: MotionZone[]
): MotionZone[] {
  if (updatedZones) {
    return updatedZones
  }

  if (existingZones.length > 0) {
    return existingZones
  }

  return [createDefaultMotionZone()]
}
