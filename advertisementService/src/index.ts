import { startUdpListener } from "./udpBroadcast";

const cleanupUdpBroadcast = startUdpListener();

const shutdown = async () => {
  console.log("Shutting down gracefully...");
  //cleanupBonjour();
  cleanupUdpBroadcast();

  // Close the se
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);