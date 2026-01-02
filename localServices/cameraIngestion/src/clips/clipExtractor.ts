import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { redis } from "../shared/redis/index";
import { db } from "../shared/db/db";
import { detectionsTable } from "../shared/db/schema/detections";
import { configRepository, CONFIG_ENTITY_ID } from "../shared/redis/config";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { RECORDING_PATH } from "../config";

const DETECTION_CHANNEL_PREFIX = process.env.DETECTION_CHANNEL_PREFIX || "detection:";
const CLIPS_PATH = process.env.CLIPS_PATH || "/recordings/clips";
const CLIP_COOLDOWN_SECONDS = parseInt(process.env.CLIP_COOLDOWN_SECONDS || "30", 10);
const DETECTION_LOOKUP_RETRIES = 3;
const DETECTION_LOOKUP_DELAY_MS = 500;

/**
 * Detection event from objectDetection service.
 */
interface DetectionEvent {
  camera_id: string;
  timestamp: number; // Unix ms
  model_used: string;
  processing_time_ms: number;
  detection_count: number;
  boxes: Array<{
    class_id: number;
    class_name: string;
    confidence: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>;
}

/**
 * ClipExtractor subscribes to detection events and extracts video clips
 * from HLS recordings around the detection timestamp.
 *
 * Features:
 * - Generates clips for all detections (even if no objects detected, motion still occurred)
 * - Cooldown period prevents duplicate clips - reuses recent clip within cooldown window
 * - Waits for postDuration before extracting to ensure footage exists
 *
 * Singleton instance - use `clipExtractor` export.
 */
export class ClipExtractor {
  private subscriber;
  private isRunningFlag = false;
  private processingQueue: Map<string, Promise<void>> = new Map();

  // Track active clips per camera to handle cooldown
  private activeClips: Map<string, { clipPath: string; timestamp: number }> = new Map();

  constructor() {
    this.subscriber = redis.duplicate();
  }

  isRunning(): boolean {
    return this.isRunningFlag;
  }

  async start(): Promise<void> {
    if (this.isRunningFlag) return;

    try {
      // Ensure clips directory exists
      await fs.promises.mkdir(CLIPS_PATH, { recursive: true });

      await this.subscriber.connect();
      this.isRunningFlag = true;

      const pattern = `${DETECTION_CHANNEL_PREFIX}*`;
      await this.subscriber.pSubscribe(pattern, async (message, channel) => {
        try {
          const event: DetectionEvent = JSON.parse(message);
          // Process all detection events (motion detected = clip worthy)
          this.queueClipExtraction(event);
        } catch (error) {
          console.error("[ClipExtractor] Error processing detection event:", error);
        }
      });

      console.log(`[ClipExtractor] Started (pattern: ${pattern}, cooldown: ${CLIP_COOLDOWN_SECONDS}s)`);
    } catch (error) {
      console.error("[ClipExtractor] Failed to start:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunningFlag) return;

    try {
      const pattern = `${DETECTION_CHANNEL_PREFIX}*`;
      await this.subscriber.pUnsubscribe(pattern);
      await this.subscriber.quit();
      this.isRunningFlag = false;

      // Wait for pending extractions
      await Promise.allSettled(this.processingQueue.values());
      this.processingQueue.clear();
      this.activeClips.clear();

      console.log("[ClipExtractor] Stopped");
    } catch (error) {
      console.error("[ClipExtractor] Error stopping:", error);
      throw error;
    }
  }

  /**
   * Queue clip extraction to avoid overwhelming the system.
   */
  private queueClipExtraction(event: DetectionEvent): void {
    const taskId = `${event.camera_id}-${event.timestamp}`;

    // Skip if already processing this detection
    if (this.processingQueue.has(taskId)) return;

    const task = this.processDetection(event)
      .catch((error) => {
        console.error(`[ClipExtractor] Failed to process ${taskId}:`, error);
      })
      .finally(() => {
        this.processingQueue.delete(taskId);
      });

    this.processingQueue.set(taskId, task);
  }

  /**
   * Clean up old entries from activeClips Map to prevent memory leak.
   */
  private cleanupActiveClips(): void {
    const now = Date.now();
    const cooldownMs = CLIP_COOLDOWN_SECONDS * 1000;
    const expiryThreshold = now - cooldownMs * 2; // Keep entries for 2x cooldown

    for (const [cameraId, clip] of this.activeClips.entries()) {
      if (clip.timestamp < expiryThreshold) {
        this.activeClips.delete(cameraId);
      }
    }
  }

  /**
   * Find detection record with retry logic to handle race condition.
   * Backend may not have written the detection to DB yet when we receive the event.
   */
  private async findDetectionWithRetry(
    cameraId: string,
    timestamp: number
  ): Promise<{ id: string } | null> {
    // Use a small time range (±100ms) to handle timestamp precision differences
    const timeRangeMs = 100;
    const minTime = new Date(timestamp - timeRangeMs);
    const maxTime = new Date(timestamp + timeRangeMs);

    for (let attempt = 0; attempt < DETECTION_LOOKUP_RETRIES; attempt++) {
      const detections = await db
        .select({ id: detectionsTable.id, cameraId: detectionsTable.cameraId })
        .from(detectionsTable)
        .where(
          and(
            eq(detectionsTable.cameraId, cameraId),
            gte(detectionsTable.timestamp, minTime),
            lte(detectionsTable.timestamp, maxTime)
          )
        )
        .limit(1);

      if (detections.length > 0) {
        return detections[0];
      }

      // Wait before retry (backend may still be writing to DB)
      if (attempt < DETECTION_LOOKUP_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, DETECTION_LOOKUP_DELAY_MS));
      }
    }

    return null;
  }

  /**
   * Process a detection - either extract new clip or reuse existing within cooldown.
   */
  private async processDetection(event: DetectionEvent): Promise<void> {
    const { camera_id, timestamp } = event;
    const cooldownMs = CLIP_COOLDOWN_SECONDS * 1000;

    // Periodically clean up old cache entries
    this.cleanupActiveClips();

    // Check cooldown FIRST (before any async operations)
    // This prevents concurrent extractions during the DB lookup delay
    const activeClip = this.activeClips.get(camera_id);
    if (activeClip && (timestamp - activeClip.timestamp) < cooldownMs) {
      // Find detection record to update it with reused clip
      const detection = await this.findDetectionWithRetry(camera_id, timestamp);
      if (detection) {
        await db
          .update(detectionsTable)
          .set({
            clipPath: activeClip.clipPath,
            clipStatus: "complete",
          })
          .where(eq(detectionsTable.id, detection.id));
      }
      console.log(`[ClipExtractor] Reusing clip for ${camera_id} (within cooldown)`);
      return;
    }

    // No active clip - reserve the slot immediately to prevent concurrent extractions
    // We'll update the path once we know the filename
    this.activeClips.set(camera_id, {
      clipPath: "", // Placeholder, updated in extractClip
      timestamp,
    });

    // Find detection record with retry logic
    const detection = await this.findDetectionWithRetry(camera_id, timestamp);
    if (!detection) {
      console.warn(`[ClipExtractor] Detection record not found for ${camera_id}@${timestamp} after retries`);
      return;
    }

    // Also check database for recent clips (in case service restarted)
    const cooldownCutoff = new Date(timestamp - cooldownMs);
    const recentDetections = await db
      .select()
      .from(detectionsTable)
      .where(
        and(
          eq(detectionsTable.cameraId, camera_id),
          eq(detectionsTable.clipStatus, "complete"),
          gte(detectionsTable.timestamp, cooldownCutoff)
        )
      )
      .orderBy(desc(detectionsTable.timestamp))
      .limit(1);

    if (recentDetections.length > 0 && recentDetections[0].clipPath) {
      // Reuse recent clip from database
      await db
        .update(detectionsTable)
        .set({
          clipPath: recentDetections[0].clipPath,
          clipStatus: "complete",
        })
        .where(eq(detectionsTable.id, detection.id));

      // Update active clip cache
      this.activeClips.set(camera_id, {
        clipPath: recentDetections[0].clipPath,
        timestamp: recentDetections[0].timestamp.getTime(),
      });

      console.log(`[ClipExtractor] Reusing recent DB clip for ${camera_id}`);
      return;
    }

    // No recent clip - extract new one
    await this.extractClip(detection.id, camera_id, timestamp);
  }

  /**
   * Extract a clip from HLS recordings around the detection timestamp.
   * Waits for postDuration before extracting to ensure footage exists.
   */
  private async extractClip(
    detectionId: string,
    cameraId: string,
    timestamp: number
  ): Promise<void> {
    // Get clip durations from global config
    const config = await configRepository.fetch(CONFIG_ENTITY_ID);
    const preDuration = config.clipPreDuration || 5;
    const postDuration = config.clipPostDuration || 10;

    // IMMEDIATELY set activeClip to prevent concurrent extractions during cooldown
    // This reserves the slot - subsequent events will reuse this clip once it's ready
    const clipFilename = `${cameraId}_${timestamp}.mp4`;
    const clipDir = path.join(CLIPS_PATH, cameraId);
    const fullClipPath = path.join(clipDir, clipFilename);

    this.activeClips.set(cameraId, {
      clipPath: fullClipPath,
      timestamp,
    });

    // Update status to processing
    await db
      .update(detectionsTable)
      .set({ clipStatus: "processing" })
      .where(eq(detectionsTable.id, detectionId));

    // Wait for postDuration to ensure the footage exists
    // Add small buffer (2s) to account for encoding delay
    const waitMs = (postDuration + 2) * 1000;
    console.log(`[ClipExtractor] Waiting ${postDuration + 2}s for footage to be recorded...`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    // Calculate start time
    const startTime = new Date(timestamp - preDuration * 1000);

    // Paths
    const cameraDir = path.join(RECORDING_PATH, cameraId);
    const playlistPath = path.join(cameraDir, "playlist.m3u8");

    // Check if recordings exist
    if (!fs.existsSync(playlistPath)) {
      console.warn(`[ClipExtractor] No recordings for camera ${cameraId}`);
      await db
        .update(detectionsTable)
        .set({ clipStatus: "failed" })
        .where(eq(detectionsTable.id, detectionId));
      return;
    }

    // Ensure camera clips directory exists
    await fs.promises.mkdir(clipDir, { recursive: true });

    try {
      // Extract clip using FFmpeg
      const totalDuration = preDuration + postDuration;
      await this.runFFmpegExtraction(playlistPath, startTime, totalDuration, fullClipPath);

      // Update detection with clip path
      await db
        .update(detectionsTable)
        .set({
          clipPath: fullClipPath,
          clipStatus: "complete",
        })
        .where(eq(detectionsTable.id, detectionId));

      console.log(`[ClipExtractor] Clip saved: ${clipFilename}`);
    } catch (error) {
      // Update status to failed
      await db
        .update(detectionsTable)
        .set({ clipStatus: "failed" })
        .where(eq(detectionsTable.id, detectionId));
      throw error;
    }
  }

  /**
   * Run FFmpeg to extract clip from HLS recording.
   */
  private async runFFmpegExtraction(
    playlistPath: string,
    startTime: Date,
    duration: number,
    outputPath: string
  ): Promise<void> {
    // Calculate seek offset from playlist start time
    const seekOffset = await this.calculateSeekOffset(playlistPath, startTime);

    return new Promise((resolve, reject) => {
      // FFmpeg args for HLS clip extraction
      // Use relative seek offset from playlist start (calculated from EXT-X-PROGRAM-DATE-TIME)
      const args = [
        "-i", playlistPath,
        "-ss", seekOffset.toString(),     // Relative offset in seconds from playlist start
        "-t", duration.toString(),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",                    // Re-encode audio for compatibility
        "-movflags", "+faststart",        // Web-friendly MP4
        "-y",                             // Overwrite
        outputPath,
      ];

      console.log(`[ClipExtractor] Extracting clip: offset=${seekOffset}s, duration=${duration}s`);

      const ffmpeg = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });

      let stderr = "";
      ffmpeg.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
        }
      });

      ffmpeg.on("error", (err) => {
        reject(err);
      });
    });
  }

  /**
   * Calculate seek offset in seconds from playlist start time.
   * Parses EXT-X-PROGRAM-DATE-TIME from first segment to determine playlist start.
   */
  private async calculateSeekOffset(playlistPath: string, targetTime: Date): Promise<number> {
    try {
      const content = await fs.promises.readFile(playlistPath, "utf-8");
      const lines = content.split("\n");

      // Find the first EXT-X-PROGRAM-DATE-TIME tag
      for (const line of lines) {
        if (line.startsWith("#EXT-X-PROGRAM-DATE-TIME:")) {
          const dateStr = line.substring("#EXT-X-PROGRAM-DATE-TIME:".length).trim();
          const playlistStartTime = new Date(dateStr);

          // Calculate offset in seconds
          const offsetMs = targetTime.getTime() - playlistStartTime.getTime();
          const offsetSec = Math.max(0, offsetMs / 1000);

          console.log(`[ClipExtractor] Playlist start: ${dateStr}, Target: ${targetTime.toISOString()}, Offset: ${offsetSec}s`);
          return offsetSec;
        }
      }

      // Fallback: if no program date time found, start from beginning
      console.warn(`[ClipExtractor] No EXT-X-PROGRAM-DATE-TIME found in playlist, using offset 0`);
      return 0;
    } catch (error) {
      console.error(`[ClipExtractor] Error parsing playlist: ${error}`);
      return 0;
    }
  }
}

// Singleton export
export const clipExtractor = new ClipExtractor();
