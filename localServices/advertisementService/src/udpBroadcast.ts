import dgram from "dgram";
import net from "net";
import { db } from "./shared/db/db";
import { errorLogsTable } from "./shared/db/schema/errorLogs";
import { doorSensorRepository, type doorSensor } from "./shared/redis/doorSensors";
import { raiseEvent } from "./shared/events/notify";
import { logError } from "./shared/db/db";

/** The port number for UDP listening */
const UDP_PORT = process.env.UDP_LISTEN_PORT
  ? Number(process.env.UDP_LISTEN_PORT)
  : 41234;

/** The service name to respond to */
const SERVICE_NAME = process.env.SERVER_NAME!;

/** The server password for authentication */
const SERVER_PASS = process.env.SERVER_PASS!;

/** The port number for the server's main service (e.g., HTTP) */
const SERVER_PORT = process.env.SERVER_PORT
  ? Number(process.env.SERVER_PORT)
  : 8080;

const CLIENT_TCP_PORT = process.env.CLIENT_TCP_PORT
  ? Number(process.env.CLIENT_TCP_PORT)
  : 31337;

/** Timeout for TCP connection in milliseconds */
const TCP_TIMEOUT = 10000; // 10 seconds

/**
 * Starts the UDP listener for service discovery
 * @returns {() => void} A function to close the UDP socket
 */
export function startUdpListener(): () => void {
  const socket = dgram.createSocket("udp4");

  socket.on("error", async (error: Error) => {
    console.error("UDP Listener error:", error);
    await logError("UDP Listener error", error);
    socket.close(() => {
      socket.bind(UDP_PORT, () => {
        console.log(`UDP Listener restarted on port ${UDP_PORT}`);
      });
    });
  });

  socket.on("message", (msg: Buffer, rinfo: dgram.RemoteInfo) => {
    const message = msg.toString();
    console.log(
      `Received UDP message from ${rinfo.address}:${rinfo.port}: ${message}`
    );

    if (message === SERVICE_NAME) {
      establishTcpConnection(rinfo.address, CLIENT_TCP_PORT);
    }
  });

  socket.bind(UDP_PORT, () => {
    console.log(`UDP Listener running on port ${UDP_PORT}`);
  });

  return () => {
    socket.close();
  };
}

/**
 * Establishes a TCP connection with a client
 * @param {string} clientIp - The IP address of the client
 * @param {number} clientPort - The port number of the client
 */
function establishTcpConnection(clientIp: string, clientPort: number): void {
  const tcpSocket = new net.Socket();

  tcpSocket.connect(clientPort, clientIp, () => {
    console.log(
      `TCP connection established with client ${clientIp}:${clientPort}`
    );
    // Set a timeout for the TCP connection in milliseconds
    tcpSocket.setTimeout(TCP_TIMEOUT);
  });

  tcpSocket.on("data", async (data: Buffer) => {
    const clientMessage = data.toString().trim();
    const sensor = (await doorSensorRepository
      .search()
      .where("externalID")
      .eq(clientMessage)
      .returnFirst()) as doorSensor | null;
    if (!sensor) {
      console.log(`Received message from client: ${clientMessage}`);
      await raiseEvent(
        {
          type: "critical",
          message: `An unrecognised device tried to connect to the server, the device has ip ${clientIp} and attempted connected via port ${clientPort}, it sent the message ${clientMessage}`,
          system: "advertisementService:udpBroadcast:TCP",
        }
      );
    } else {
      tcpSocket.write(SERVER_PASS);
      console.log(`Received message from client: ${clientMessage}`);
    }
    // After processing, close the connection
    tcpSocket.end();
    tcpSocket.destroy();
  });

  tcpSocket.on("timeout", () => {
    console.error(
      `TCP connection timed out with client ${clientIp}:${clientPort}`
    );
    tcpSocket.destroy();
  });

  tcpSocket.on("error", async (error: Error) => {
    console.error(
      `TCP connection error with client ${clientIp}:${clientPort}:`,
      error
    );
    await logError(`advertisementService:udpBroadcast:TCP`, error);
    tcpSocket.destroy();
  });

  tcpSocket.on("close", () => {
    console.log(`TCP connection closed with client ${clientIp}:${clientPort}`);
  });
}


