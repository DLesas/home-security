import { createClient } from "redis";
import { Repository, Schema } from "redis-om";

export const redis = createClient({
  url: `redis://redis:6379`
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
