import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

let ioInstance: Server;

/**
 * Sets up Socket.IO server with Redis adapter for multi-process support
 * @async
 * @param {Server} io - The Socket.IO server instance
 * @returns {Promise<void>} A promise that resolves when setup is complete
 */
const setupSocketHandlers = async (io: Server) => {
  ioInstance = io;

  // Create Redis clients for the Socket.IO adapter
  const pubClient = createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  });
  const subClient = pubClient.duplicate();

  // Connect both clients
  await Promise.all([pubClient.connect(), subClient.connect()]);

  // Configure Socket.IO to use Redis adapter for distributed broadcasting
  io.adapter(createAdapter(pubClient, subClient));
  console.log("Socket.IO Redis adapter enabled - ready for multi-process scaling");

  // Set up error handlers for adapter Redis clients
  pubClient.on("error", (err) =>
    console.error("Socket.IO adapter pub client error:", err)
  );
  subClient.on("error", (err) =>
    console.error("Socket.IO adapter sub client error:", err)
  );

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Handle camera subscription requests
    socket.on("subscribe:camera", (cameraId: string) => {
      const roomName = `camera:${cameraId}`;
      socket.join(roomName);
      console.log(`Client ${socket.id} subscribed to ${roomName}`);
    });

    // Handle camera unsubscription requests
    socket.on("unsubscribe:camera", (cameraId: string) => {
      const roomName = `camera:${cameraId}`;
      socket.leave(roomName);
      console.log(`Client ${socket.id} unsubscribed from ${roomName}`);
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};

/**
 * Emits a camera frame to all clients subscribed to this camera
 * @param {string} cameraId - The ID of the camera that captured the frame
 * @param {Buffer} frame - The JPEG frame buffer
 * @param {number} timestamp - Unix timestamp when frame was captured
 */
export function emitFrame(
  cameraId: string,
  frame: Buffer,
  timestamp: number
): void {
  if (!ioInstance) {
    console.error("Socket.IO not initialized - cannot emit frame");
    return;
  }

  // Emit to room for this specific camera
  const roomName = `camera:${cameraId}`;
  ioInstance.to(roomName).emit("camera:frame", {
    cameraId,
    frame,
    timestamp,
  });
}

export default setupSocketHandlers;
