import { Redis, Cluster } from "ioredis";
export type QueueType = "bull" | "bullmq" | "bullmq-pro";
import { RedisOptions } from "ioredis";
import * as url from "url";

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

export const getQueueType = async (
  queueName: string,
  prefix: string,
  client: Redis | Cluster
): Promise<{ type: QueueType; majorVersion: number; version?: string }> => {
  // Check if queue includes the "meta" key, if so, it is a bullmq queue type.
  const metaKey = `${prefix}:${queueName}:meta`;

  // check if meta key includes the field "pro"
  // if so, it is a bullmq-pro queue type.
  const hasMeta = await client.exists(metaKey);
  if (hasMeta) {
    const longVersion = await client.hget(metaKey, "version");
    const version = longVersion ? longVersion.split(":")[1] : "";

    if (longVersion) {
      const type = longVersion.includes("bullmq-pro") ? "bullmq-pro" : "bullmq";

      // Try to get the major version number from the version string (e.g. bullmq:3.20.0)
      const majorVersionStr = version?.split(".")[0];
      const majorVersion = majorVersionStr ? parseInt(majorVersionStr, 10) : 0;
      if (majorVersion >= 3) {
        return { type, majorVersion, version };
      }
    }

    const maxLenEvents = await client.hget(metaKey, "opts.maxLenEvents");
    if (maxLenEvents) {
      return { type: "bullmq", majorVersion: 0, version };
    }
  }

  // otherwise, it is a bull queue type.
  return { type: "bull", majorVersion: 0 };
};
