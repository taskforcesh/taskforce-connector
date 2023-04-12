import { Redis, Cluster, RedisOptions } from "ioredis";

import { QueueType, getQueueType } from "./utils";
import { queueKey } from "./queues-cache";
import { Queue } from "bullmq";
import * as Bull from "bull";
import { BullMQResponders, BullResponders } from "./responders";
import { Responders } from "./responders/responders";

const chalk = require("chalk");

const queueNameRegExp = new RegExp("(.*):(.*):id");
const maxCount = 50000;
const maxTime = 30000;

// We keep a redis client that we can reuse for all the queues.
let redisClient: Redis | Cluster;

export interface FoundQueue {
  prefix: string;
  name: string;
  type: QueueType;
}

const getQueueKeys = async (client: Redis | Cluster) => {
  let keys = [],
    cursor = "0";
  const startTime = Date.now();

  do {
    const [nextCursor, scannedKeys] = await client.scan(
      cursor,
      "MATCH",
      "*:*:id",
      "COUNT",
      maxCount
    );
    cursor = nextCursor;

    keys.push(...scannedKeys);
  } while (Date.now() - startTime < maxTime && cursor !== "0");

  return keys;
};

export async function getConnectionQueues(
  redisOpts: RedisOptions,
  clusterNodes?: string[]
): Promise<FoundQueue[]> {
  const queues = await execRedisCommand(
    redisOpts,
    async (client) => {
      const keys = await getQueueKeys(client);

      const queues = await Promise.all(
        keys
          .map(function (key) {
            var match = queueNameRegExp.exec(key);
            if (match) {
              return {
                prefix: match[1],
                name: match[2],
                type: "bull", // default to bull
              };
            }
          })
          .filter((queue) => queue !== undefined)
          .map(async function (queue) {
            const type = await getQueueType(queue.name, queue.prefix, client);
            queue.type = type;
            return queue;
          })
      );
      return queues;
    },
    clusterNodes
  );

  return queues;
}

export async function ping(redisOpts: RedisOptions, clusterNodes?: string[]) {
  return execRedisCommand(redisOpts, (client) => client.ping(), clusterNodes);
}

export async function getRedisInfo(
  redisOpts: RedisOptions,
  clusterNodes?: string[]
) {
  const info = await execRedisCommand(
    redisOpts,
    (client) => client.info(),
    clusterNodes
  );
  return info;
}

export function getRedisClient(
  redisOpts: RedisOptions,
  clusterNodes?: string[]
) {
  if (!redisClient) {
    if (clusterNodes && clusterNodes.length) {
      redisClient = new Redis.Cluster(clusterNodes, redisOpts);
    } else {
      redisClient = new Redis(redisOpts);
    }

    redisClient.on("error", (err: Error) => {
      console.log(
        `${chalk.yellow("Redis:")} ${chalk.red("redis connection error")} ${
          err.message
        }`
      );
    });

    redisClient.on("connect", () => {
      console.log(
        `${chalk.yellow("Redis:")} ${chalk.green("connected to redis server")}`
      );
    });

    redisClient.on("end", () => {
      console.log(
        `${chalk.yellow("Redis:")} ${chalk.blueBright(
          "disconnected from redis server"
        )}`
      );
    });
  }

  return redisClient;
}

export async function execRedisCommand(
  redisOpts: RedisOptions,
  cb: (client: Redis | Cluster) => any,
  clusterNodes?: string[]
) {
  const redisClient = getRedisClient(redisOpts, clusterNodes);

  const result = await cb(redisClient);

  return result;
}

export function createQueue(
  foundQueue: FoundQueue,
  redisOpts: RedisOptions,
  nodes?: string[]
): { queue: Bull.Queue | Queue; responders: Responders } {
  const createClient = function (type: "client" /*, redisOpts */) {
    switch (type) {
      case "client":
        return getRedisClient(redisOpts, nodes);
      default:
        throw new Error(`Unexpected connection type: ${type}`);
    }
  };

  switch (foundQueue.type) {
    case "bullmq-pro":
    case "bullmq":
      return {
        queue: new Queue(foundQueue.name, {
          connection: getRedisClient(redisOpts, nodes),
          prefix: foundQueue.prefix,
        }),
        responders: BullMQResponders,
      };

    case "bull":
      return {
        queue: new Bull(foundQueue.name, {
          createClient,
          prefix: foundQueue.prefix,
        }),
        responders: BullResponders,
      };
    default:
      throw new Error(`Unexpected queue type: ${foundQueue.type}`);
  }
}
