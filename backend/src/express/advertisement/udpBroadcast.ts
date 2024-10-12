import dgram from "dgram";
import os from "os";
import { db } from "../../db/db";
import { errorLogsTable } from "../../db/schema/errorLogs";

/** The broadcast address for UDP messages */
const BROADCAST_ADDR = process.env.UDP_BROADCAST_ADDR || "255.255.255.255";

/** The port number for UDP broadcasting */
const PORT = process.env.UDP_BROADCAST_PORT ? Number(process.env.UDP_BROADCAST_PORT) : 41234;

/** The interval (in milliseconds) between broadcast messages */
const INTERVAL_MS = process.env.UDP_BROADCAST_INTERVAL ? Number(process.env.UDP_BROADCAST_INTERVAL) : 10000;

/**
 * Starts UDP broadcasting on all available IPv4 network interfaces.
 * 
 * This function creates UDP sockets for each non-internal IPv4 interface,
 * sets up error handling, and initiates periodic broadcasting of a message
 * containing the server's name, port, and IP address.
 * 
 * @returns {() => void} A cleanup function that stops all broadcasts and closes all sockets when called.
 */
export function startUdpBroadcast(): () => void {
  const sockets: dgram.Socket[] = [];
  const intervalIds: NodeJS.Timeout[] = [];

  const networkInterfaces = os.networkInterfaces();

  Object.values(networkInterfaces).forEach((interfaces) => {
    interfaces?.forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) {
        const socket = dgram.createSocket("udp4");
        const message = `${process.env.BROADCASTING_NAME}; port:${process.env.SERVER_PORT}; ip:${iface.address}`;

        /**
         * Handles socket initialization errors.
         * 
         * @param {Error} error - The error object thrown during socket initialization.
         */
        socket.on("error", async (error: Error) => {
          console.error(`UDP Broadcasting socket initialization error on ${iface.address}:`, error);
          await db.insert(errorLogsTable).values({
            endpoint: `UDP Broadcasting socket initialization error on ${iface.address}`,
            errorTrace: error.stack + "\n" + error.message + "\n" + String(error),
            level: "critical",
          });
        });

        /**
         * Broadcasts the message to the specified address and port.
         */
        const broadcast = () => {
          socket.send(message, PORT, BROADCAST_ADDR, async (error) => {
            if (error) {
              console.error(`UDP Broadcasting socket send error on ${iface.address}:`, error);
              await db.insert(errorLogsTable).values({
                endpoint: `UDP Broadcasting socket send error on ${iface.address}`,
                errorTrace: error.stack + "\n" + error.message + "\n" + String(error),
                level: "critical",
              });
            }
          });
        };

        /**
         * Binds the socket to the interface address and sets up periodic broadcasting.
         */
        socket.bind({ address: iface.address }, () => {
          socket.setBroadcast(true);
          const intervalId = setInterval(broadcast, INTERVAL_MS);
          intervalIds.push(intervalId);
        });

        sockets.push(socket);
      }
    });
  });

  /**
   * Cleanup function that stops all broadcasts and closes all sockets.
   */
  return () => {
    intervalIds.forEach(clearInterval);
    sockets.forEach((socket) => socket.close());
  };
}
