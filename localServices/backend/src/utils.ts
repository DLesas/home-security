import { uuidv7 } from "uuidv7";
import { Request } from "express";

/**
 * Generates a UUID v7 without hyphens.
 *
 * @returns {string} The generated ID.
 */
export const makeID = (): string => {
  return uuidv7().replace(/-/g, "");
};

/**
 * Converts IPv4-mapped IPv6 addresses to IPv4 format.
 * Leaves other formats, including real IPv6 addresses, unchanged.
 *
 * @param {string | undefined} ip - The IP address to process.
 * @returns {string | undefined} The IPv4 address if it was an IPv4-mapped IPv6 address, the original IP if it's a valid string, or undefined if the input was undefined.
 */
export const normalizeIpAddress = (
  ip: string | undefined
): string | undefined => {
  // Return undefined if the input is undefined
  if (ip === undefined) {
    return undefined;
  }

  // Check if it's an IPv4-mapped IPv6 address
  if (ip.startsWith("::ffff:")) {
    return ip.substring(7);
  }

  // For all other formats, including real IPv6 addresses, return as is
  return ip;
};

/**
 * Retrieves the IP address of the client making the request.
 * This function checks the x-real-ip header, the x-forwarded-for header,
 * the ip address from the request object, the remote address from the socket,
 * and returns the first non-empty value.
 * This is built specifically for docker and reverse proxies.
 *
 * @param {Request} req - The request object.
 * @returns {string} The IP address of the client.
 */
export const getIpAddress = (req: Request): string => {
  const clientIP =
    req.header("x-real-ip") ||
    req.header("x-forwarded-for")?.split(",")[0] ||
    req.ip ||
    req.socket.remoteAddress ||
    "";
  return clientIP;
};
