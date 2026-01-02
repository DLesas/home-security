import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface EncoderInfo {
  name: string;
  type: "hardware" | "software";
  preset?: string;
  description: string;
}

/**
 * Hardware encoder priority order (best to worst)
 * NVIDIA first for production servers, then platform-specific fallbacks
 */
const ENCODER_PRIORITY: EncoderInfo[] = [
  {
    name: "h264_nvenc",
    type: "hardware",
    preset: "p1",
    description: "NVIDIA NVENC",
  },
  {
    name: "h264_videotoolbox",
    type: "hardware",
    description: "Apple VideoToolbox",
  },
  {
    name: "h264_qsv",
    type: "hardware",
    preset: "veryfast",
    description: "Intel Quick Sync Video",
  },
  {
    name: "h264_vaapi",
    type: "hardware",
    description: "VA-API (Linux Intel/AMD)",
  },
  {
    name: "h264_amf",
    type: "hardware",
    description: "AMD AMF",
  },
  {
    name: "libx264",
    type: "software",
    preset: "ultrafast",
    description: "x264 software encoder (fallback)",
  },
];

// Cached detection results
let availableEncoders: EncoderInfo[] = [];
let detectionComplete = false;

// Per-camera encoder tracking
const cameraEncoders = new Map<string, EncoderInfo>();

// NVENC-specific tracking (only encoder with hard limits)
const nvencCameras = new Set<string>();
let nvencLimit: number | null = null;

/**
 * Detect all available hardware encoders at startup
 */
export async function detectAvailableEncoders(): Promise<EncoderInfo[]> {
  if (detectionComplete) return availableEncoders;

  console.log("[HardwareEncoder] Detecting available H.264 encoders...");

  for (const encoder of ENCODER_PRIORITY) {
    try {
      // Use 256x256 for NVENC (has minimum resolution requirements)
      const testCmd = `ffmpeg -hide_banner -f lavfi -i testsrc=size=256x256:duration=0.1 -c:v ${encoder.name} -f null - 2>&1`;
      const { stdout, stderr } = await execAsync(testCmd, { timeout: 5000 });
      const output = stdout + stderr;

      const hasError =
        output.includes("Unknown encoder") ||
        output.includes("Encoder not found") ||
        output.includes("is not supported") ||
        output.includes("Cannot load");

      if (!hasError) {
        availableEncoders.push(encoder);
        console.log(`[HardwareEncoder] ✓ ${encoder.name}: ${encoder.description}`);
      } else {
        console.log(`[HardwareEncoder] ✗ ${encoder.name}: not available`);
      }
    } catch {
      console.log(`[HardwareEncoder] ✗ ${encoder.name}: not available`);
    }
  }

  detectionComplete = true;

  if (availableEncoders.length === 0) {
    const fallback = ENCODER_PRIORITY[ENCODER_PRIORITY.length - 1];
    availableEncoders.push(fallback);
    console.log(`[HardwareEncoder] Using fallback: ${fallback.name}`);
  } else {
    console.log(`[HardwareEncoder] ${availableEncoders.length} encoder(s) available`);
  }

  return availableEncoders;
}

function canUseNvenc(): boolean {
  if (nvencLimit === null) return true;
  return nvencCameras.size < nvencLimit;
}

function getFallbackEncoder(): EncoderInfo {
  return (
    availableEncoders.find((e) => e.name !== "h264_nvenc") ??
    ENCODER_PRIORITY[ENCODER_PRIORITY.length - 1]
  );
}

/**
 * Assign encoder to a camera (handles NVENC slot tracking)
 */
export function assignEncoder(cameraId: string): EncoderInfo {
  const existing = cameraEncoders.get(cameraId);
  if (existing !== undefined) return existing;

  const nvenc = availableEncoders.find((e) => e.name === "h264_nvenc");

  if (nvenc && canUseNvenc()) {
    nvencCameras.add(cameraId);
    cameraEncoders.set(cameraId, nvenc);
    console.log(
      `[HardwareEncoder] Camera ${cameraId}: NVENC (${nvencCameras.size}/${nvencLimit ?? "?"} slots)`
    );
    return nvenc;
  }

  const fallback = getFallbackEncoder();
  cameraEncoders.set(cameraId, fallback);
  console.log(`[HardwareEncoder] Camera ${cameraId}: ${fallback.name}`);
  return fallback;
}

/**
 * Handle NVENC failure - learn limit, reassign to fallback
 */
export function onNvencFailure(cameraId: string): EncoderInfo {
  nvencLimit = nvencCameras.size;
  nvencCameras.delete(cameraId);
  console.log(`[HardwareEncoder] NVENC limit discovered: ${nvencLimit} streams`);

  const fallback = getFallbackEncoder();
  cameraEncoders.set(cameraId, fallback);
  console.log(`[HardwareEncoder] Camera ${cameraId}: fallback to ${fallback.name}`);
  return fallback;
}

/**
 * Release encoder when camera stops
 */
export function releaseEncoder(cameraId: string): void {
  const encoder = cameraEncoders.get(cameraId);
  cameraEncoders.delete(cameraId);

  if (encoder?.name === "h264_nvenc") {
    nvencCameras.delete(cameraId);
    console.log(
      `[HardwareEncoder] Camera ${cameraId}: NVENC slot released (${nvencCameras.size}/${nvencLimit ?? "?"} in use)`
    );
  }
}

/**
 * Get FFmpeg encoder args for a camera
 */
export function getEncoderArgs(cameraId: string): string[] {
  const encoder = cameraEncoders.get(cameraId);
  if (!encoder) {
    return ["-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency"];
  }

  const args = ["-c:v", encoder.name];
  if (encoder.preset) args.push("-preset", encoder.preset);

  switch (encoder.name) {
    case "h264_videotoolbox":
      args.push("-allow_sw", "1", "-realtime", "1");
      break;
    case "h264_nvenc":
      args.push("-tune", "ll", "-rc", "cbr", "-zerolatency", "1");
      break;
    case "h264_qsv":
      args.push("-look_ahead", "0", "-global_quality", "23");
      break;
    case "h264_amf":
      args.push("-quality", "speed");
      break;
    case "libx264":
      args.push("-tune", "zerolatency", "-crf", "23");
      break;
  }

  return args;
}

/**
 * Check if stderr indicates NVENC failure
 */
export function isNvencFailure(stderr: string): boolean {
  const patterns = [
    /cannot.*create.*encoder/i,
    /nvenc.*init.*failed/i,
    /exceeded.*session/i,
    /too many.*sessions/i,
    /OpenEncodeSessionEx failed/i,
    /NV_ENC_ERR_OUT_OF_MEMORY/i,
    /Cannot load libnvidia-encode/i,
  ];
  return patterns.some((p) => p.test(stderr));
}

/**
 * Get encoder assigned to a camera
 */
export function getCameraEncoder(cameraId: string): EncoderInfo | null {
  return cameraEncoders.get(cameraId) ?? null;
}
