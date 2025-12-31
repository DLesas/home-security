import { redis } from "./redis";
import { io } from "./index";
import { db } from "./db/db";
import { detectionsTable } from "./db/schema/detections";
import { detectionBoxesTable } from "./db/schema/detectionBoxes";
import { cameraRepository } from "./redis/cameras";
import { makeID } from "./utils";
import { raiseEvent } from "./events/notify";
import type { ObjectDetectionModel, DetectionClass } from "./db/schema/cameraSettings";

const DETECTION_CHANNEL_PREFIX = process.env.DETECTION_CHANNEL_PREFIX || "detection:";

/**
 * Detection event from objectDetection service.
 * Matches: localServices/objectDetection/src/output/detection_publisher.py:_build_event()
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
 * Detection Event Subscriber that handles detection results from Redis pub/sub,
 * writes them to PostgreSQL, and emits to Socket.IO clients.
 *
 * Singleton instance - use `detectionEventSubscriber` export.
 */
export class DetectionEventSubscriber {
  private subscriber;
  private isRunningFlag = false;

  constructor() {
    this.subscriber = redis.duplicate();
  }

  /**
   * Returns whether the subscriber is currently running.
   */
  isRunning(): boolean {
    return this.isRunningFlag;
  }

  /**
   * Starts the detection event subscriber using pattern subscription.
   */
  async start(): Promise<void> {
    if (this.isRunningFlag) return;

    try {
      await this.subscriber.connect();
      this.isRunningFlag = true;

      // Pattern subscribe to all detection channels
      const pattern = `${DETECTION_CHANNEL_PREFIX}*`;
      await this.subscriber.pSubscribe(pattern, async (message, channel) => {
        try {
          const event: DetectionEvent = JSON.parse(message);
          await this.processDetection(event);
        } catch (error) {
          console.error("Error processing detection event:", error);
        }
      });

      console.log(`Detection Event Subscriber started (pattern: ${pattern})`);
    } catch (error) {
      console.error("Failed to start Detection Event Subscriber:", error);
      throw error;
    }
  }

  /**
   * Process a detection event - write to DB, emit to clients, raise event.
   */
  private async processDetection(event: DetectionEvent): Promise<void> {
    const detectionId = makeID();

    // Get camera name for event message
    const cameras = await cameraRepository
      .search()
      .where("externalID")
      .eq(event.camera_id)
      .return.all();
    const cameraName = cameras[0]?.name || event.camera_id;
    const buildingName = cameras[0]?.building || "Unknown";

    // Insert detection and boxes in a transaction
    await db.transaction(async (tx) => {
      // Insert detection record
      await tx.insert(detectionsTable).values({
        id: detectionId,
        cameraId: event.camera_id,
        timestamp: new Date(event.timestamp),
        modelUsed: event.model_used as ObjectDetectionModel,
        processingTimeMs: event.processing_time_ms,
        clipStatus: "pending",
      });

      // Insert detection boxes
      if (event.boxes.length > 0) {
        await tx.insert(detectionBoxesTable).values(
          event.boxes.map((box) => ({
            id: makeID(),
            detectionId,
            classId: box.class_id,
            className: box.class_name as DetectionClass,
            confidence: box.confidence,
            x1: box.x1,
            y1: box.y1,
            x2: box.x2,
            y2: box.y2,
          }))
        );
      }
    });

    // Emit to Socket.IO clients
    io.emit("detection", {
      id: detectionId,
      cameraId: event.camera_id,
      timestamp: new Date(event.timestamp).toISOString(),
      modelUsed: event.model_used,
      processingTimeMs: event.processing_time_ms,
      boxes: event.boxes,
    });

    // Build detection summary for event
    const classCounts = event.boxes.reduce((acc, box) => {
      acc[box.class_name] = (acc[box.class_name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const summary = Object.entries(classCounts)
      .map(([cls, count]) => `${count} ${cls}${count > 1 ? "s" : ""}`)
      .join(", ");

    // Raise event for detection
    await raiseEvent({
      type: "info",
      message: `Movement detected on camera:${cameraName} in ${buildingName}; ${summary || "unknown objects"}`,
      system: "backend:objectDetection",
    });

    console.log(
      `Detection saved: camera=${cameraName}, ` +
        `boxes=${event.boxes.length}, time=${event.processing_time_ms.toFixed(1)}ms`
    );
  }

  /**
   * Stops the detection event subscriber.
   */
  async stop(): Promise<void> {
    if (!this.isRunningFlag) return;

    try {
      const pattern = `${DETECTION_CHANNEL_PREFIX}*`;
      await this.subscriber.pUnsubscribe(pattern);
      await this.subscriber.quit();
      this.isRunningFlag = false;
      console.log("Detection Event Subscriber stopped");
    } catch (error) {
      console.error("Error stopping Detection Event Subscriber:", error);
      throw error;
    }
  }
}

// Singleton export
export const detectionEventSubscriber = new DetectionEventSubscriber();
