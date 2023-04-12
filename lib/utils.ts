import { Redis, Cluster } from "ioredis";
export type QueueType = "bull" | "bullmq" | "bullmq-pro";

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
      return "bullmq"; // "bullmq-pro"; // bullmq-pro is not supported yet.
    }

    const maxLenEvents = await client.hget(metaKey, "opts.maxLenEvents");
    if (maxLenEvents) {
      return "bullmq";
    }
  }

  // otherwise, it is a bull queue type.
  return "bull";
};
