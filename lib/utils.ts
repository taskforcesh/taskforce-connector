import { Redis, Cluster } from "ioredis";
export type QueueType = "bull" | "bullmq" | "bullmq-pro";
import { RedisOptions } from "ioredis";
import * as url from "url";

export const getQueueType = async (
  queueName: string,
  prefix: string,
  client: Redis | Cluster
): Promise<QueueType> => {
  // Check if queue includes the "meta" key, if so, it is a bullmq or bullmq pro queue type.
  const metaKey = `${prefix}:${queueName}:meta`;

  // Check if meta key includes the field "pro"
  // if so, it is a bullmq-pro queue type.
  const hasMeta = await client.exists(metaKey);
  if (hasMeta) {
    const version = await client.hget(metaKey, "version");
    if (version && version.includes("bullmq-pro")) {
      return "bullmq-pro"; // Will fail unless a bullmq-pro integration is provided.
    }

    const maxLenEvents = await client.hget(metaKey, "opts.maxLenEvents");
    if (maxLenEvents) {
      return "bullmq";
    }
  }

  // otherwise, it is a bull queue type.
  return "bull";
};


export function redisOptsFromUrl(urlString: string) {
  const redisOpts: RedisOptions = {};
  try {
    const redisUrl = url.parse(urlString);
    redisOpts.port = parseInt(redisUrl.port) || 6379;
    redisOpts.host = redisUrl.hostname;
    redisOpts.db = redisUrl.pathname
      ? parseInt(redisUrl.pathname.split("/")[1])
      : 0;
    if (redisUrl.auth) {
      const username = redisUrl.auth.split(":")[0];
      redisOpts.username = username ? username : undefined;
      redisOpts.password = redisUrl.auth.split(":")[1];
    }
  } catch (e) {
    throw new Error(e.message);
  }
  return redisOpts;
}