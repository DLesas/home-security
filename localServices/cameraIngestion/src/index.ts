import "./config";
import { Server } from "socket.io";
import { SERVER_PORT } from "./config";
import setupSocketHandlers from "./socketHandler";
import { StreamManager } from "./streamManager";
import { connectRedis } from "./shared/redis/index";
import { createCameraIndex } from "./shared/redis/cameras";
import { cpuMonitor } from "./cpuMonitor";

const io = new Server({
  cors: {
    origin: true, // Allow all origins for development
  },
  maxHttpBufferSize: 1e8, // 100MB for large frame buffers
});

// Connect to Redis and create indexes
await connectRedis();
await createCameraIndex();

// Setup Socket.IO with Redis adapter
await setupSocketHandlers(io);

io.listen(SERVER_PORT);

console.log(`Camera Ingestion Service running on port ${SERVER_PORT}`);

// Start CPU monitoring for adaptive quality control
cpuMonitor.start();
console.log("[Main] CPU monitor started");

// Initialize StreamManager to start processing camera streams
const streamManager = new StreamManager();
await streamManager.initialize();

console.log("[Main] Camera Ingestion Service fully initialized");

const shutdown = async () => {
  console.log("Shutting down gracefully...");

  // Stop CPU monitor
  cpuMonitor.stop();

  // Stop stream manager
  await streamManager.stop();

  // Close Socket.IO connections
  io.close(() => {
    console.log("Socket.IO server closed");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { io };
