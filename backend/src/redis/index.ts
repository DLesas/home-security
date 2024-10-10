import { createClient } from "redis";
import { Repository, Schema } from "redis-om";

export const redis = createClient({
  url: `redis://redis-stack:6379`
});
redis.on("error", (error: string) => console.error('Redis Client Error', error));
export const connectRedis = async () => {
  try {
    await redis.connect();
    console.log("Connected to Redis successfully");
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    throw error;
  }
};

export const writeRedisCheckpoint = async () => {
  try {
    const result = await redis.sendCommand(['BGSAVE']);
    console.log("Redis checkpoint written successfully:", result);
  } catch (error) {
    console.error("Failed to write Redis checkpoint:", error);
    throw error;
  }
};
