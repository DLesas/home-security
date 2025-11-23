import { uuidv7 } from "uuidv7";
import { Request } from "express";
import { ResultAsync } from "neverthrow";

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

/**
 * Truncates a string from the beginning to ensure it doesn't exceed the specified byte limit.
 * This preserves the end of the string which typically contains the most important error details.
 *
 * @param {string} text - The text to truncate.
 * @param {number} maxBytes - The maximum byte length allowed (default: 2048).
 * @returns {string} The truncated text with "..." prefix if truncation occurred.
 */
export const truncateFromBeginning = (
  text: string,
  maxBytes: number = 2048
): string => {
  if (!text) return text;

  // Convert to Buffer to check byte length (not character length)
  const textBuffer = Buffer.from(text, "utf8");

  if (textBuffer.length <= maxBytes) {
    return text;
  }

  const prefix = "...";
  const prefixBuffer = Buffer.from(prefix, "utf8");
  const availableBytes = maxBytes - prefixBuffer.length;

  if (availableBytes <= 0) {
    // If maxBytes is too small even for the prefix, just return truncated text
    return text.slice(-Math.floor(maxBytes / 4)); // Rough approximation for UTF-8
  }

  // Find the right position to truncate from the end
  let truncatedText = text;
  let truncatedBuffer = textBuffer;

  while (truncatedBuffer.length > availableBytes) {
    // Remove characters from the beginning until we fit
    truncatedText = truncatedText.slice(1);
    truncatedBuffer = Buffer.from(truncatedText, "utf8");
  }

  return prefix + truncatedText;
};

/**
 * Retries a function with exponential backoff delay.
 *
 * @template T - The success type of the Result
 * @template E - The error type of the Result
 * @param {() => ResultAsync<T, E>} fn - The function to retry that returns a ResultAsync
 * @param {number} maxRetries - Maximum number of retry attempts (default: 5)
 * @param {number} initialDelayMs - Initial delay in milliseconds (default: 100)
 * @param {number} maxDelayMs - Maximum delay in milliseconds (default: 10000)
 * @returns {ResultAsync<T, E>} The result of the function after retries
 */
export function retryWithExponentialBackoff<T, E>(
  fn: () => ResultAsync<T, E>,
  maxRetries: number = 5,
  initialDelayMs: number = 100,
  maxDelayMs: number = 10000
): ResultAsync<T, E> {
  const attemptWithBackoff = async (
    attempt: number
  ): Promise<ResultAsync<T, E>> => {
    const result = await fn();

    if (result.isOk() || attempt >= maxRetries) {
      return result;
    }

    // Calculate exponential backoff delay: initialDelay * 2^attempt
    const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);

    await new Promise((resolve) => setTimeout(resolve, delay));

    return attemptWithBackoff(attempt + 1);
  };

  return ResultAsync.fromPromise(
    attemptWithBackoff(0),
    (error) => error as E
  ).andThen((result) => result);
};
