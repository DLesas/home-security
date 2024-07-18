import { createClient } from "redis";
import { Schema, Repository } from 'redis-om'

export const redis = createClient();
redis.on("error", (error: string) => console.error(error));
await redis.connect();
