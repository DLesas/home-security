import { redis } from "./redis";
import { type Camera } from "./redis/cameras";

// Function to get latest frame
export async function getLatestFrame(cameraId: Camera["externalID"]) {
  const streamKey = `camera:${cameraId}:stream`;

  // Get only the most recent entry
  const entries = await redis.xRevRange(
    streamKey,
    "+", // Latest entry
    "-", // Earliest entry
    { COUNT: 1 }
  );

  if (entries && entries.length > 0) {
    const entry = entries[0];
    const id = entry.id;
    const fields = entry.message;
    return {
      id,
      image: fields.image, // Raw binary buffer
      timestamp: Number(fields.timestamp),
      detections: JSON.parse(fields.detections),
    };
  }

  return null;
}

/**
 * Retrieves and deletes frames from a camera's stream within a specified time window
 * @param cameraId - The external ID of the camera
 * @param seconds - Number of seconds to look back in time
 * @returns An array of frame objects containing id, image, timestamp, and detections.
 *          Returns an empty array if no frames are found.
 */
export async function getAndDeleteFrames(
  cameraId: Camera["externalID"], 
  seconds: number
): Promise<Array<{
  id: string;
  image: Buffer;
  timestamp: number;
  detections: any; // Consider defining a more specific type for detections
}>> {
  const streamKey = `camera:${cameraId}:stream`;
  
  // Calculate timestamp from seconds ago
  const timeAgo = Date.now() - seconds * 1000;
  // Convert to Redis stream ID format (timestamp-0)
  const startId = `${timeAgo}-0`;

  // Get entries from seconds ago until now
  const entries = await redis.xRevRange(
    streamKey,
    "+",           // Latest entry
    startId        // From seconds ago
  );

  if (entries && entries.length > 0) {
    // Delete the entries we just read
    const ids = entries.map(entry => entry.id);
    await redis.xDel(streamKey, ids);

    // Process and return the entries
    return entries.map(entry => ({
      id: entry.id,
      image: Buffer.from(entry.message.image),
      timestamp: Number(entry.message.timestamp),
      detections: JSON.parse(entry.message.detections),
    }));
  }

  return [];
}
 