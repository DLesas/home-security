// Camera ingestion service configuration
export const SERVER_PORT = parseInt(process.env.SERVER_PORT || "8082", 10);
export const RECORDING_PATH = process.env.RECORDING_PATH || "/recordings";
export const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS || "7", 10);
export const SEGMENT_DURATION_SECONDS = parseInt(
  process.env.SEGMENT_DURATION_SECONDS || "600",
  10
);

// Frame processing configuration
export const AI_SAMPLING_RATE = parseInt(
  process.env.AI_SAMPLING_RATE || "3",
  10
);

// Adaptive JPEG quality (adjusts based on CPU load)
export const JPEG_QUALITY_MIN = parseInt(
  process.env.JPEG_QUALITY_MIN || "50",
  10
);
export const JPEG_QUALITY_MAX = parseInt(
  process.env.JPEG_QUALITY_MAX || "80",
  10
);
export const CPU_THRESHOLD_HIGH = parseInt(
  process.env.CPU_THRESHOLD_HIGH || "80",
  10
);
export const CPU_THRESHOLD_LOW = parseInt(
  process.env.CPU_THRESHOLD_LOW || "50",
  10
);

// Stream defaults (720p for better performance)
export const DEFAULT_STREAM_FPS = parseInt(
  process.env.DEFAULT_STREAM_FPS || "30",
  10
);
export const DEFAULT_STREAM_WIDTH = parseInt(
  process.env.DEFAULT_STREAM_WIDTH || "1280",
  10
);
export const DEFAULT_STREAM_HEIGHT = parseInt(
  process.env.DEFAULT_STREAM_HEIGHT || "720",
  10
);


console.log("Camera Ingestion Service Configuration:");
console.log("  SERVER_PORT:", SERVER_PORT);
console.log("  RECORDING_PATH:", RECORDING_PATH);
console.log("  RETENTION_DAYS:", RETENTION_DAYS);
console.log("  SEGMENT_DURATION_SECONDS:", SEGMENT_DURATION_SECONDS);
console.log("  AI_SAMPLING_RATE:", AI_SAMPLING_RATE);
console.log("  JPEG_QUALITY:", `Adaptive ${JPEG_QUALITY_MIN}-${JPEG_QUALITY_MAX} (CPU: ${CPU_THRESHOLD_LOW}%-${CPU_THRESHOLD_HIGH}%)`);
console.log("  DEFAULT_STREAM:", `${DEFAULT_STREAM_WIDTH}x${DEFAULT_STREAM_HEIGHT} @ ${DEFAULT_STREAM_FPS} FPS`);
