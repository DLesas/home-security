import { createClient } from "redis";
import { Repository, Schema } from "redis-om";

export const redis = createClient({
  url: `redis://:${process.env.REDIS_PASSWORD}@redis:6379`
});
redis.on("error", (error: string) => console.error(error));
await redis.connect();
