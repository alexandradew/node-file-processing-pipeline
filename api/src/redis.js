import { createRedisClient } from "queue";

export const redisClient = createRedisClient();
await redisClient.connect();
