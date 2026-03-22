import {
  DEFAULT_CLASS_CONFIGS,
  cameraProtocolSchema,
  classConfigsSchema,
  motionZonesSchema,
  parseMotionModelSettings,
  type CameraDto,
  type CameraProtocol,
  type ClassConfig,
  type MotionModelSettings,
  type MotionZone,
} from "../db/shared/camera";
import type { Camera } from "../redis/cameras";

type StoredJsonValue<TValue> = TValue | string | null | undefined;

export type RedisCameraEntity = Omit<
  Camera,
  "lastUpdated" | "modelSettings" | "motionZones" | "classConfigs" | "protocol"
> & {
  protocol?: CameraProtocol | string;
  lastUpdated: Date | string;
  modelSettings?: StoredJsonValue<MotionModelSettings>;
  motionZones?: StoredJsonValue<MotionZone[]>;
  classConfigs?: StoredJsonValue<ClassConfig[]>;
};

function parseJsonField<TValue>(
  value: StoredJsonValue<TValue>,
  fallback: TValue
): TValue {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as TValue;
  } catch {
    return fallback;
  }
}

export function parseStoredMotionZones(
  value: StoredJsonValue<MotionZone[]>
): MotionZone[] {
  const parsed = parseJsonField(value, []);
  const result = motionZonesSchema.safeParse(parsed);
  return result.success ? result.data : [];
}

export function parseStoredClassConfigs(
  value: StoredJsonValue<ClassConfig[]>
): ClassConfig[] {
  const parsed = parseJsonField(value, DEFAULT_CLASS_CONFIGS);
  const result = classConfigsSchema.safeParse(parsed);
  return result.success ? result.data : DEFAULT_CLASS_CONFIGS;
}

export function parseStoredModelSettings(
  detectionModel: CameraDto["detectionModel"],
  value: StoredJsonValue<MotionModelSettings>
): MotionModelSettings {
  return parseMotionModelSettings(detectionModel, parseJsonField(value, null));
}

function parseProtocol(
  value: RedisCameraEntity["protocol"]
): CameraProtocol | undefined {
  if (!value) {
    return undefined;
  }

  const result = cameraProtocolSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function toCameraDto(camera: RedisCameraEntity): CameraDto {
  return {
    externalID: camera.externalID,
    name: camera.name,
    building: camera.building,
    ipAddress: camera.ipAddress,
    port: camera.port,
    protocol: parseProtocol(camera.protocol),
    username: camera.username,
    password: camera.password,
    streamPath: camera.streamPath,
    expectedSecondsUpdated: camera.expectedSecondsUpdated,
    lastUpdated: toIsoString(camera.lastUpdated),
    targetWidth: camera.targetWidth,
    targetHeight: camera.targetHeight,
    motionDetectionEnabled: camera.motionDetectionEnabled,
    detectionModel: camera.detectionModel,
    modelSettings: parseStoredModelSettings(
      camera.detectionModel,
      camera.modelSettings
    ),
    motionZones: parseStoredMotionZones(camera.motionZones),
    maxStreamFps: camera.maxStreamFps,
    maxRecordingFps: camera.maxRecordingFps,
    jpegQuality: camera.jpegQuality ?? 95,
    objectDetectionEnabled: camera.objectDetectionEnabled,
    classConfigs: parseStoredClassConfigs(camera.classConfigs),
  };
}

export function serializeCameraJsonFields(camera: Pick<
  CameraDto,
  "modelSettings" | "motionZones" | "classConfigs"
>): {
  modelSettings: string;
  motionZones: string;
  classConfigs: string;
} {
  return {
    modelSettings: JSON.stringify(camera.modelSettings),
    motionZones: JSON.stringify(camera.motionZones),
    classConfigs: JSON.stringify(camera.classConfigs),
  };
}
