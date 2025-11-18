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
 * - videotoolbox: macOS/iOS hardware encoding (Apple Silicon, Intel)
 * - nvenc: NVIDIA GPU encoding
 * - qsv: Intel Quick Sync Video
 * - vaapi: Linux VA-API (Intel/AMD)
 * - amf: AMD GPU encoding
 * - libx264: Software encoding (fallback)
 */
const ENCODER_PRIORITY: EncoderInfo[] = [
  {
    name: "h264_videotoolbox",
    type: "hardware",
    description: "Apple VideoToolbox (macOS/iOS hardware acceleration)",
  },
  {
    name: "h264_nvenc",
    type: "hardware",
    preset: "p1", // Fastest preset for NVENC
    description: "NVIDIA NVENC hardware encoder",
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
    description: "AMD AMF hardware encoder",
  },
  {
    name: "libx264",
    type: "software",
    preset: "ultrafast",
    description: "x264 software encoder (fallback)",
  },
];

let cachedEncoder: EncoderInfo | null = null;

/**
 * Detect the best available H.264 encoder on this system
 * Tests encoders in priority order and returns the first working one
 */
export async function detectBestH264Encoder(): Promise<EncoderInfo> {
  // Return cached result if already detected
  if (cachedEncoder) {
    return cachedEncoder;
  }

  console.log("[HardwareEncoder] Detecting available H.264 encoders...");

  for (const encoder of ENCODER_PRIORITY) {
    try {
      // Test if encoder is available by running a quick encode test
      const testCommand = `ffmpeg -hide_banner -f lavfi -i testsrc=size=64x64:duration=0.1 -c:v ${encoder.name} -f null - 2>&1`;

      const { stderr } = await execAsync(testCommand, { timeout: 5000 });

      // Check if the command succeeded (encoder is available)
      if (!stderr.includes("Unknown encoder") && !stderr.includes("Encoder not found")) {
        cachedEncoder = encoder;
        console.log(
          `[HardwareEncoder] ✓ Selected: ${encoder.name} (${encoder.description})`
        );
        return encoder;
      }
    } catch (error) {
      // Encoder not available, try next one
      continue;
    }
  }

  // Fallback to libx264 (should always be available)
  cachedEncoder = ENCODER_PRIORITY[ENCODER_PRIORITY.length - 1];
  console.log(
    `[HardwareEncoder] ⚠ Using fallback: ${cachedEncoder.name} (${cachedEncoder.description})`
  );
  return cachedEncoder;
}

/**
 * Get FFmpeg encoder arguments based on detected hardware
 */
export async function getEncoderArgs(): Promise<string[]> {
  const encoder = await detectBestH264Encoder();
  const args: string[] = ["-c:v", encoder.name];

  // Add preset if applicable
  if (encoder.preset) {
    args.push("-preset", encoder.preset);
  }

  // Add encoder-specific optimizations
  switch (encoder.name) {
    case "h264_videotoolbox":
      // VideoToolbox-specific options
      args.push(
        "-allow_sw", "1", // Allow software fallback if needed
        "-realtime", "1" // Enable realtime encoding
      );
      break;

    case "h264_nvenc":
      // NVENC-specific options
      args.push(
        "-tune", "ll", // Low latency
        "-rc", "cbr", // Constant bitrate
        "-zerolatency", "1"
      );
      break;

    case "h264_qsv":
      // Quick Sync-specific options
      args.push(
        "-look_ahead", "0", // Disable lookahead for lower latency
        "-global_quality", "23" // Quality level (lower = better)
      );
      break;

    case "libx264":
      // Software encoder options
      args.push(
        "-tune", "zerolatency",
        "-crf", "23" // Constant rate factor (quality)
      );
      break;
  }

  return args;
}

/**
 * Get current encoder info (after detection)
 */
export function getCurrentEncoder(): EncoderInfo | null {
  return cachedEncoder;
}
