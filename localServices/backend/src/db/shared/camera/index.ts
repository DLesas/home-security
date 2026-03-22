import { z } from "zod";

export const CAMERA_PROTOCOLS = ["udp", "rtsp"] as const;
export type CameraProtocol = (typeof CAMERA_PROTOCOLS)[number];
export const cameraProtocolSchema = z.enum(CAMERA_PROTOCOLS);

export const DETECTION_MODELS = ["simple_diff", "knn", "mog2"] as const;
export type DetectionModel = (typeof DETECTION_MODELS)[number];
export const detectionModelSchema = z.enum(DETECTION_MODELS);

export const DETECTION_CLASSES = [
  "person",
  "bicycle",
  "car",
  "motorcycle",
  "airplane",
  "bus",
  "train",
  "truck",
  "boat",
  "bird",
  "cat",
  "dog",
  "horse",
  "sheep",
  "cow",
  "elephant",
  "bear",
  "zebra",
  "giraffe",
] as const;
export type DetectionClass = (typeof DETECTION_CLASSES)[number];

export const classConfigSchema = z
  .object({
    class: z.enum(DETECTION_CLASSES),
    confidence: z.number().min(0).max(1).default(0.5),
  })
  .strict();
export type ClassConfig = z.infer<typeof classConfigSchema>;

export const classConfigsSchema = z
  .array(classConfigSchema)
  .superRefine((configs, ctx) => {
    const seen = new Set<DetectionClass>();

    configs.forEach((config, index) => {
      if (seen.has(config.class)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each detection class can only be configured once",
          path: [index, "class"],
        });
        return;
      }

      seen.add(config.class);
    });
  });

export const DEFAULT_CLASS_CONFIGS: ClassConfig[] = [
  { class: "person", confidence: 0.5 },
  { class: "car", confidence: 0.5 },
  { class: "dog", confidence: 0.5 },
  { class: "cat", confidence: 0.5 },
];

/** No `.strict()` — strip unknown keys so legacy/extra fields in Redis/DB don’t fail parsing. */
export const simpleDiffSettingsSchema = z.object({
  threshold: z.coerce.number().int().min(0).max(255).default(25),
});
export type SimpleDiffSettings = z.infer<typeof simpleDiffSettingsSchema>;

export const knnSettingsSchema = z.object({
  history: z.coerce.number().int().min(1).default(500),
  dist2Threshold: z.coerce.number().min(0).default(400),
  detectShadows: z.boolean().default(false),
});
export type KNNSettings = z.infer<typeof knnSettingsSchema>;

export const mog2SettingsSchema = z.object({
  history: z.coerce.number().int().min(1).default(500),
  varThreshold: z.coerce.number().min(0).default(16),
  detectShadows: z.boolean().default(false),
});
export type MOG2Settings = z.infer<typeof mog2SettingsSchema>;

export type MotionModelSettings =
  | SimpleDiffSettings
  | KNNSettings
  | MOG2Settings;

export const DEFAULT_MODEL_SETTINGS: Record<DetectionModel, MotionModelSettings> =
  {
    simple_diff: { threshold: 25 },
    knn: { history: 500, dist2Threshold: 400, detectShadows: false },
    mog2: { history: 500, varThreshold: 16, detectShadows: false },
  };

export function getDefaultModelSettings(
  model: DetectionModel
): MotionModelSettings {
  switch (model) {
    case "simple_diff":
      return { ...DEFAULT_MODEL_SETTINGS.simple_diff };
    case "knn":
      return { ...DEFAULT_MODEL_SETTINGS.knn };
    case "mog2":
    default:
      return { ...DEFAULT_MODEL_SETTINGS.mog2 };
  }
}

/**
 * Parse model settings for the given detector. Never throws: invalid or mismatched
 * stored JSON (e.g. after changing detectionModel, strict extra keys, or legacy shapes)
 * falls back to defaults so API routes don't 500 on PUT when merging with motion zones.
 */
export function parseMotionModelSettings(
  model: DetectionModel,
  settings: unknown
): MotionModelSettings {
  if (settings === undefined || settings === null) {
    return getDefaultModelSettings(model);
  }

  const fallback = (): MotionModelSettings => getDefaultModelSettings(model);

  switch (model) {
    case "simple_diff": {
      const result = simpleDiffSettingsSchema.safeParse(settings);
      return result.success ? result.data : fallback();
    }
    case "knn": {
      const result = knnSettingsSchema.safeParse(settings);
      return result.success ? result.data : fallback();
    }
    case "mog2":
    default: {
      const result = mog2SettingsSchema.safeParse(settings);
      return result.success ? result.data : fallback();
    }
  }
}

export const motionZonePointSchema = z.tuple([
  z.number().int().min(0),
  z.number().int().min(0),
]);
export type MotionZonePoint = z.infer<typeof motionZonePointSchema>;

export const motionZoneSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    points: z.array(motionZonePointSchema).default([]),
    minContourArea: z.number().int().min(1).max(1_000_000).default(2500),
    thresholdPercent: z.number().min(0).max(100).default(2.5),
  })
  .strict()
  .superRefine((zone, ctx) => {
    if (zone.points.length > 0 && zone.points.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A polygon motion zone must contain at least 3 points",
        path: ["points"],
      });
    }
  });
export type MotionZone = z.infer<typeof motionZoneSchema>;

export const motionZonesSchema = z
  .array(motionZoneSchema)
  .min(1, "At least one motion zone is required")
  .superRefine((zones, ctx) => {
    const seen = new Set<string>();

    zones.forEach((zone, index) => {
      if (seen.has(zone.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Motion zone ids must be unique per camera",
          path: [index, "id"],
        });
        return;
      }

      seen.add(zone.id);
    });
  });

export function isFullFrameMotionZone(zone: MotionZone): boolean {
  return zone.points.length === 0;
}

export interface CameraDto {
  externalID: string;
  name: string;
  building: string;
  ipAddress?: string;
  port: number;
  protocol?: CameraProtocol;
  username?: string;
  password?: string;
  streamPath?: string;
  expectedSecondsUpdated: number;
  lastUpdated: string;
  targetWidth?: number;
  targetHeight?: number;
  motionDetectionEnabled: boolean;
  detectionModel: DetectionModel;
  modelSettings: MotionModelSettings;
  motionZones: MotionZone[];
  maxStreamFps?: number;
  maxRecordingFps?: number;
  jpegQuality: number;
  objectDetectionEnabled: boolean;
  classConfigs: ClassConfig[];
}

export type CameraUpdatePayload = Partial<
  Pick<
    CameraDto,
    | "name"
    | "building"
    | "targetWidth"
    | "targetHeight"
    | "motionDetectionEnabled"
    | "detectionModel"
    | "modelSettings"
    | "motionZones"
    | "maxStreamFps"
    | "maxRecordingFps"
    | "jpegQuality"
    | "objectDetectionEnabled"
    | "classConfigs"
  >
>;

export interface DeletedCameraConfigDto {
  externalID: string;
}

export type CameraConfigEventAction = "created" | "updated" | "deleted";

export interface CameraConfigEvent {
  timestamp: number;
  action: CameraConfigEventAction;
  camera: CameraDto | DeletedCameraConfigDto;
}

export interface MotionZoneEventResult {
  zone_id: string;
  zone_name: string;
  has_motion: boolean;
  motion_percentage: number;
  motion_regions: number;
  total_motion_pixels: number;
}

export interface CameraMotionEvent {
  camera_id: string;
  timestamp: number;
  motion_detected: boolean;
  processing_time_ms: number;
  zone_results: MotionZoneEventResult[];
  mask: string;
  original_frame?: string;
}
