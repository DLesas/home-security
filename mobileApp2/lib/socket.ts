import { io, Socket } from "socket.io-client";

export const createSocket = (url: string): Socket => io(url);
