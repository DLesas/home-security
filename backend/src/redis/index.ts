import { createClient, RedisClientType } from "redis";

/**
 * Redis client instance.
 */
export const redis: RedisClientType = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});

redis.on("error", (error: Error) => console.error('Redis Client Error', error));

/**
 * Attempts to connect to Redis with retry logic.
 * @param {number} [maxRetries=50] - Number of retry attempts.
 * @param {number} [retryInterval=1000] - Interval between retries in milliseconds.
 * @returns {Promise<RedisClientType>} The connected Redis client.
 * @throws {Error} If unable to connect after all retries.
 */
export async function connectRedis(maxRetries: number = 50, retryInterval: number = 1000): Promise<RedisClientType> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await redis.connect();
      console.log('Successfully connected to Redis');
      return redis;
    } catch (error) {
      console.error(`Failed to connect to Redis (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryInterval}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      } else {
        throw new Error(`Failed to connect to Redis after ${maxRetries} retries`);
      }
    }
  }
  // This line should never be reached due to the throw in the loop, but TypeScript needs it
  throw new Error('Failed to connect to Redis');
}

/**
 * Writes a Redis checkpoint using the BGSAVE command.
 * This function initiates a background save operation in Redis.
 * 
 * @function writeRedisCheckpoint
 * @returns {Promise<void>} A promise that resolves when the checkpoint is successfully written.
 * @throws {Error} If the checkpoint write operation fails.
 */
export const writeRedisCheckpoint = async (): Promise<void> => {
  try {
    const result = await redis.sendCommand(['BGSAVE']);
    console.log("Redis checkpoint written successfully:", result);
  } catch (error) {
    console.error("Failed to write Redis checkpoint:", error);
    throw error;
  }
};
