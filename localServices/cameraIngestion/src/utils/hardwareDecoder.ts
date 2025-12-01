import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface DecoderInfo {
  name: string;
  hwaccel: string;
  decoder?: string; // Explicit decoder name (e.g., h264_cuvid)
  type: "hardware" | "software";
  description: string;
}

/**
 * Hardware decoder priority order (best to worst)
 * - nvdec: NVIDIA GPU decoding (has HARD session limits)
 * - videotoolbox: macOS hardware decoding (soft limits)
 * - qsv: Intel Quick Sync (soft limits)
 * - vaapi: Linux VA-API (soft limits)
 */
const DECODER_PRIORITY: DecoderInfo[] = [
  {
    name: "nvdec",
    hwaccel: "cuda",
    decoder: "h264_cuvid",
    type: "hardware",
    description: "NVIDIA NVDEC (CUDA)",
  },
  {
    name: "videotoolbox",
    hwaccel: "videotoolbox",
    type: "hardware",
    description: "Apple VideoToolbox",
  },
  {
    name: "qsv",
    hwaccel: "qsv",
    type: "hardware",
    description: "Intel Quick Sync Video",
  },
  {
    name: "vaapi",
    hwaccel: "vaapi",
    type: "hardware",
    description: "VA-API (Linux Intel/AMD)",
  },
];

// Cached detection results
let availableDecoders: DecoderInfo[] = [];
let detectionComplete = false;

// Per-camera decoder tracking
const cameraDecoders = new Map<string, DecoderInfo | null>();

// NVDEC-specific tracking (only decoder with hard limits)
const nvdecCameras = new Set<string>();
let nvdecLimit: number | null = null;

/**
 * Detect all available hardware decoders at startup
 * Tests each decoder by running a quick FFmpeg probe
 */
export async function detectAvailableDecoders(): Promise<DecoderInfo[]> {
  if (detectionComplete) return availableDecoders;

  console.log("[HardwareDecoder] Detecting available hardware decoders...");

  for (const decoder of DECODER_PRIORITY) {
    try {
      // Test if hwaccel is available by running a quick decode test
      const testCmd = `ffmpeg -hide_banner -hwaccel ${decoder.hwaccel} -f lavfi -i nullsrc=s=64x64:d=0.1 -f null - 2>&1`;
      const { stdout, stderr } = await execAsync(testCmd, { timeout: 5000 });
      const output = stdout + stderr;

      // Check for hwaccel-specific errors
      const hasError =
        output.includes("hwaccel") && output.includes("not found") ||
        output.includes("Unknown hwaccel") ||
        output.includes("No decoder surfaces left") ||
        output.includes("Failed to initialise") ||
        output.includes("does not support device type");

      if (!hasError) {
        availableDecoders.push(decoder);
        console.log(`[HardwareDecoder] ✓ ${decoder.name}: ${decoder.description}`);
      } else {
        console.log(`[HardwareDecoder] ✗ ${decoder.name}: not available`);
      }
    } catch {
      // Command failed - decoder not available
      console.log(`[HardwareDecoder] ✗ ${decoder.name}: not available`);
    }
  }

  detectionComplete = true;

  if (availableDecoders.length === 0) {
    console.log("[HardwareDecoder] No hardware decoders available, using software decode");
  } else {
    console.log(`[HardwareDecoder] ${availableDecoders.length} decoder(s) available`);
  }

  return availableDecoders;
}

/**
 * Check if NVDEC has available slots
 * Returns true if limit unknown (optimistic) or if under limit
 */
function canUseNvdec(): boolean {
  if (nvdecLimit === null) return true;
  return nvdecCameras.size < nvdecLimit;
}

/**
 * Get fallback decoder (first non-NVDEC decoder)
 */
function getFallbackDecoder(): DecoderInfo | null {
  return availableDecoders.find((d) => d.name !== "nvdec") || null;
}

/**
 * Assign decoder to a camera
 * Handles NVDEC slot tracking, falls back to next best if NVDEC full
 *
 * @param cameraId - Unique camera identifier
 * @returns Assigned decoder info, or null for software decode
 */
export function assignDecoder(cameraId: string): DecoderInfo | null {
  // Check if already assigned (restart case)
  const existing = cameraDecoders.get(cameraId);
  if (existing !== undefined) {
    return existing;
  }

  if (availableDecoders.length === 0) {
    cameraDecoders.set(cameraId, null);
    return null;
  }

  const nvdec = availableDecoders.find((d) => d.name === "nvdec");

  // Try NVDEC if available and has capacity
  if (nvdec && canUseNvdec()) {
    nvdecCameras.add(cameraId);
    cameraDecoders.set(cameraId, nvdec);
    console.log(
      `[HardwareDecoder] Camera ${cameraId}: NVDEC (${nvdecCameras.size}/${nvdecLimit ?? "?"} slots)`
    );
    return nvdec;
  }

  // Fallback to next best (soft limits, no tracking needed)
  const fallback = getFallbackDecoder();
  cameraDecoders.set(cameraId, fallback);
  if (fallback) {
    console.log(`[HardwareDecoder] Camera ${cameraId}: ${fallback.name}`);
  } else {
    console.log(`[HardwareDecoder] Camera ${cameraId}: software decode`);
  }
  return fallback;
}

/**
 * Handle NVDEC failure - learn limit, reassign to fallback
 * Called when FFmpeg fails with NVDEC-related error
 *
 * @param cameraId - Camera that failed
 * @returns New decoder assignment (fallback)
 */
export function onNvdecFailure(cameraId: string): DecoderInfo | null {
  // Learn the limit: current count is the max
  nvdecLimit = nvdecCameras.size;
  nvdecCameras.delete(cameraId);
  console.log(`[HardwareDecoder] NVDEC limit discovered: ${nvdecLimit} streams`);

  const fallback = getFallbackDecoder();
  cameraDecoders.set(cameraId, fallback);

  if (fallback) {
    console.log(`[HardwareDecoder] Camera ${cameraId}: fallback to ${fallback.name}`);
  } else {
    console.log(`[HardwareDecoder] Camera ${cameraId}: fallback to software decode`);
  }
  return fallback;
}

/**
 * Release decoder when camera stops
 * Frees up NVDEC slot if applicable
 *
 * @param cameraId - Camera being stopped
 */
export function releaseDecoder(cameraId: string): void {
  const decoder = cameraDecoders.get(cameraId);
  cameraDecoders.delete(cameraId);

  if (decoder?.name === "nvdec") {
    nvdecCameras.delete(cameraId);
    console.log(
      `[HardwareDecoder] Camera ${cameraId}: NVDEC slot released (${nvdecCameras.size}/${nvdecLimit ?? "?"} in use)`
    );
  }
}

/**
 * Get FFmpeg decoder args for a camera
 * Returns empty array for software decode
 *
 * @param cameraId - Camera identifier
 * @returns FFmpeg arguments for hardware decoding
 */
export function getDecoderArgs(cameraId: string): string[] {
  const decoder = cameraDecoders.get(cameraId);
  if (!decoder) return [];

  const args = ["-hwaccel", decoder.hwaccel];

  // Add explicit decoder if specified (e.g., h264_cuvid for NVDEC)
  if (decoder.decoder) {
    args.push("-c:v", decoder.decoder);
  }

  return args;
}

/**
 * Check if stderr indicates NVDEC failure
 * Used to detect when NVDEC session limit is reached
 *
 * @param stderr - FFmpeg stderr output
 * @returns True if NVDEC-related failure detected
 */
export function isNvdecFailure(stderr: string): boolean {
  const patterns = [
    /cannot.*create.*decoder/i,
    /failed.*init.*nvdec/i,
    /hwaccel.*init.*failed/i,
    /cuda.*out.*of.*memory/i,
    /decoder.*session/i,
    /No decoder surfaces left/i,
    /Failed to create CUVID decoder/i,
    /CUDA_ERROR_OUT_OF_MEMORY/i,
  ];
  return patterns.some((p) => p.test(stderr));
}

/**
 * Get decoder assigned to a camera
 *
 * @param cameraId - Camera identifier
 * @returns Decoder info or null if not assigned/software decode
 */
export function getCameraDecoder(cameraId: string): DecoderInfo | null {
  return cameraDecoders.get(cameraId) ?? null;
}

/**
 * Get current decoder statistics (for debugging/monitoring)
 */
export function getDecoderStats(): {
  availableDecoders: string[];
  nvdecLimit: number | null;
  nvdecInUse: number;
  totalCameras: number;
} {
  return {
    availableDecoders: availableDecoders.map((d) => d.name),
    nvdecLimit,
    nvdecInUse: nvdecCameras.size,
    totalCameras: cameraDecoders.size,
  };
}
