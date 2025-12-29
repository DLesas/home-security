import express from "express";
import * as fs from "fs";
import * as path from "path";
import { raiseError } from "../../events/notify";
import { cameraRepository } from "../../redis/cameras";

const router = express.Router();

// Hardcoded recordings path (mounted from Docker volume)
const RECORDINGS_PATH = "/recordings";

/**
 * Validate that a resolved path stays within the recordings directory.
 * Prevents path traversal attacks (e.g., cameraId = "../../../etc")
 */
function isPathSafe(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const recordingsRoot = path.resolve(RECORDINGS_PATH);
  return resolved.startsWith(recordingsRoot + path.sep) || resolved === recordingsRoot;
}

/**
 * Parse HLS playlist to extract segment information with timestamps
 */
interface PlaylistSegment {
  filename: string;
  duration: number;
  programDateTime?: Date;
}

function parsePlaylist(playlistContent: string): PlaylistSegment[] {
  const segments: PlaylistSegment[] = [];
  const lines = playlistContent.split("\n");

  let currentProgramDateTime: Date | undefined;
  let currentDuration: number | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    // Parse program date time
    if (trimmed.startsWith("#EXT-X-PROGRAM-DATE-TIME:")) {
      const dateStr = trimmed.replace("#EXT-X-PROGRAM-DATE-TIME:", "");
      currentProgramDateTime = new Date(dateStr);
    }

    // Parse duration
    if (trimmed.startsWith("#EXTINF:")) {
      const durationStr = trimmed.replace("#EXTINF:", "").split(",")[0];
      currentDuration = parseFloat(durationStr);
    }

    // Segment file line (not a comment, not empty)
    if (trimmed && !trimmed.startsWith("#") && trimmed.endsWith(".ts")) {
      segments.push({
        filename: trimmed,
        duration: currentDuration ?? 0,
        programDateTime: currentProgramDateTime,
      });
      currentProgramDateTime = undefined;
      currentDuration = undefined;
    }
  }

  return segments;
}

/**
 * @route GET /:cameraId/metadata
 * @description Get recording metadata for a camera
 */
router.get("/:cameraId/metadata", async (req, res, next) => {
  const { cameraId } = req.params;

  try {
    // Verify camera exists
    const cameras = await cameraRepository
      .search()
      .where("externalID")
      .eq(cameraId)
      .return.all();

    if (cameras.length === 0) {
      next(raiseError(404, `Camera '${cameraId}' not found`));
      return;
    }

    const cameraDir = path.join(RECORDINGS_PATH, cameraId);
    const playlistPath = path.join(cameraDir, "playlist.m3u8");

    // Path traversal check
    if (!isPathSafe(playlistPath)) {
      next(raiseError(400, "Invalid camera ID"));
      return;
    }

    // Check if recordings exist
    if (!fs.existsSync(playlistPath)) {
      res.status(200).json({
        cameraId,
        hasRecordings: false,
        oldestRecording: null,
        newestRecording: null,
        segmentDurationSeconds: 0,
        totalSegments: 0,
      });
      return;
    }

    // Read and parse playlist
    const playlistContent = await fs.promises.readFile(playlistPath, "utf-8");
    const segments = parsePlaylist(playlistContent);

    if (segments.length === 0) {
      res.status(200).json({
        cameraId,
        hasRecordings: false,
        oldestRecording: null,
        newestRecording: null,
        segmentDurationSeconds: 0,
        totalSegments: 0,
      });
      return;
    }

    // Get oldest and newest timestamps
    const segmentsWithTime = segments.filter(s => s.programDateTime);
    const oldestRecording = segmentsWithTime.length > 0
      ? segmentsWithTime[0].programDateTime
      : null;

    // Calculate newest recording end time (start + duration of last segment)
    const lastSegment = segmentsWithTime[segmentsWithTime.length - 1];
    const newestRecording = lastSegment?.programDateTime
      ? new Date(lastSegment.programDateTime.getTime() + (lastSegment.duration * 1000))
      : null;

    // Average segment duration
    const avgDuration = segments.reduce((sum, s) => sum + s.duration, 0) / segments.length;

    res.status(200).json({
      cameraId,
      hasRecordings: true,
      oldestRecording: oldestRecording?.toISOString() ?? null,
      newestRecording: newestRecording?.toISOString() ?? null,
      segmentDurationSeconds: Math.round(avgDuration),
      totalSegments: segments.length,
    });
  } catch (err) {
    console.error("Error fetching recording metadata:", err);
    next(raiseError(500, "Failed to fetch recording metadata"));
  }
});

/**
 * @route GET /:cameraId/manifest
 * @description Serve the HLS playlist manifest
 */
router.get("/:cameraId/manifest", async (req, res, next) => {
  const { cameraId } = req.params;

  try {
    const playlistPath = path.join(RECORDINGS_PATH, cameraId, "playlist.m3u8");

    // Path traversal check
    if (!isPathSafe(playlistPath)) {
      next(raiseError(400, "Invalid camera ID"));
      return;
    }

    if (!fs.existsSync(playlistPath)) {
      next(raiseError(404, `No recordings found for camera '${cameraId}'`));
      return;
    }

    // Read playlist and rewrite segment URLs to use our API
    const playlistContent = await fs.promises.readFile(playlistPath, "utf-8");

    // Replace segment filenames with full API URLs
    const rewrittenPlaylist = playlistContent.replace(
      /^(segment-\d+\.ts)$/gm,
      `/api/v1/recordings/${cameraId}/segments/$1`
    );

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "no-cache");
    res.send(rewrittenPlaylist);
  } catch (err) {
    console.error("Error serving manifest:", err);
    next(raiseError(500, "Failed to serve manifest"));
  }
});

/**
 * @route GET /:cameraId/segments/:filename
 * @description Serve individual HLS segment files
 */
router.get("/:cameraId/segments/:filename", async (req, res, next) => {
  const { cameraId, filename } = req.params;

  // Validate filename pattern to prevent path traversal via filename
  if (!filename.match(/^segment-\d{5}\.ts$/)) {
    next(raiseError(400, "Invalid segment filename"));
    return;
  }

  try {
    const segmentPath = path.join(RECORDINGS_PATH, cameraId, filename);

    // Path traversal check
    if (!isPathSafe(segmentPath)) {
      next(raiseError(400, "Invalid camera ID"));
      return;
    }

    if (!fs.existsSync(segmentPath)) {
      next(raiseError(404, `Segment '${filename}' not found`));
      return;
    }

    // Get file stats for content-length
    const stats = await fs.promises.stat(segmentPath);

    res.setHeader("Content-Type", "video/MP2T");
    res.setHeader("Content-Length", stats.size);
    res.setHeader("Cache-Control", "public, max-age=31536000"); // Segments are immutable

    // Stream the segment file
    const stream = fs.createReadStream(segmentPath);
    stream.pipe(res);
  } catch (err) {
    console.error("Error serving segment:", err);
    next(raiseError(500, "Failed to serve segment"));
  }
});

/**
 * @route GET /:cameraId/seek
 * @description Find the segment containing a specific timestamp
 * @query timestamp - ISO 8601 timestamp to seek to
 */
router.get("/:cameraId/seek", async (req, res, next) => {
  const { cameraId } = req.params;
  const { timestamp } = req.query;

  if (!timestamp || typeof timestamp !== "string") {
    next(raiseError(400, "timestamp query parameter required (ISO 8601 format)"));
    return;
  }

  const seekTime = new Date(timestamp);
  if (isNaN(seekTime.getTime())) {
    next(raiseError(400, "Invalid timestamp format. Use ISO 8601."));
    return;
  }

  try {
    const playlistPath = path.join(RECORDINGS_PATH, cameraId, "playlist.m3u8");

    // Path traversal check
    if (!isPathSafe(playlistPath)) {
      next(raiseError(400, "Invalid camera ID"));
      return;
    }

    if (!fs.existsSync(playlistPath)) {
      next(raiseError(404, `No recordings found for camera '${cameraId}'`));
      return;
    }

    const playlistContent = await fs.promises.readFile(playlistPath, "utf-8");
    const segments = parsePlaylist(playlistContent);

    // Find the segment that contains the requested timestamp
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (!segment.programDateTime) continue;

      const segmentStart = segment.programDateTime.getTime();
      const segmentEnd = segmentStart + (segment.duration * 1000);

      if (seekTime.getTime() >= segmentStart && seekTime.getTime() < segmentEnd) {
        // Calculate offset within the segment
        const offsetSeconds = (seekTime.getTime() - segmentStart) / 1000;

        res.status(200).json({
          found: true,
          segmentIndex: i,
          segmentFile: segment.filename,
          segmentStartTime: segment.programDateTime.toISOString(),
          offsetSeconds: Math.round(offsetSeconds * 10) / 10,
          manifestUrl: `/api/v1/recordings/${cameraId}/manifest`,
        });
        return;
      }
    }

    // Timestamp not found in any segment
    const segmentsWithTime = segments.filter(s => s.programDateTime);
    const oldest = segmentsWithTime[0]?.programDateTime;
    const newest = segmentsWithTime[segmentsWithTime.length - 1]?.programDateTime;

    res.status(200).json({
      found: false,
      message: "Timestamp not found in available recordings",
      availableRange: oldest && newest ? {
        start: oldest.toISOString(),
        end: new Date(newest.getTime() + (segmentsWithTime[segmentsWithTime.length - 1]?.duration ?? 0) * 1000).toISOString(),
      } : null,
    });
  } catch (err) {
    console.error("Error seeking recording:", err);
    next(raiseError(500, "Failed to seek in recording"));
  }
});

/**
 * @route GET /building/:buildingId/metadata
 * @description Get recording metadata for all cameras in a building
 */
router.get("/building/:buildingId/metadata", async (req, res, next) => {
  const { buildingId } = req.params;

  try {
    // Get all cameras in the building
    const cameras = await cameraRepository
      .search()
      .where("building")
      .eq(buildingId)
      .return.all();

    if (cameras.length === 0) {
      next(raiseError(404, `No cameras found in building '${buildingId}'`));
      return;
    }

    // Collect metadata for each camera
    const camerasMetadata = await Promise.all(
      cameras.map(async (camera) => {
        const cameraId = camera.externalID;
        const cameraDir = path.join(RECORDINGS_PATH, cameraId);
        const playlistPath = path.join(cameraDir, "playlist.m3u8");

        // Path traversal check (camera IDs come from Redis, but be safe)
        if (!isPathSafe(playlistPath)) {
          return {
            cameraId,
            cameraName: camera.name,
            hasRecordings: false,
            oldestRecording: null,
            newestRecording: null,
            totalSegments: 0,
          };
        }

        if (!fs.existsSync(playlistPath)) {
          return {
            cameraId,
            cameraName: camera.name,
            hasRecordings: false,
            oldestRecording: null,
            newestRecording: null,
            totalSegments: 0,
          };
        }

        const playlistContent = await fs.promises.readFile(playlistPath, "utf-8");
        const segments = parsePlaylist(playlistContent);
        const segmentsWithTime = segments.filter(s => s.programDateTime);

        const oldest = segmentsWithTime[0]?.programDateTime;
        const last = segmentsWithTime[segmentsWithTime.length - 1];
        const newest = last?.programDateTime
          ? new Date(last.programDateTime.getTime() + (last.duration * 1000))
          : null;

        return {
          cameraId,
          cameraName: camera.name,
          hasRecordings: segments.length > 0,
          oldestRecording: oldest?.toISOString() ?? null,
          newestRecording: newest?.toISOString() ?? null,
          totalSegments: segments.length,
        };
      })
    );

    // Calculate building-wide time range
    const allOldest = camerasMetadata
      .filter(c => c.oldestRecording)
      .map(c => new Date(c.oldestRecording!).getTime());
    const allNewest = camerasMetadata
      .filter(c => c.newestRecording)
      .map(c => new Date(c.newestRecording!).getTime());

    res.status(200).json({
      buildingId,
      cameras: camerasMetadata,
      overallTimeRange: allOldest.length > 0 ? {
        start: new Date(Math.min(...allOldest)).toISOString(),
        end: new Date(Math.max(...allNewest)).toISOString(),
      } : null,
    });
  } catch (err) {
    console.error("Error fetching building recording metadata:", err);
    next(raiseError(500, "Failed to fetch building recording metadata"));
  }
});

export default router;
