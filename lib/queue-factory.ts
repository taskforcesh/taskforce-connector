import { Redis, Cluster, RedisOptions } from "ioredis";

import { QueueType, getQueueType, redisOptsFromUrl } from "./utils";
import { Queue } from "bullmq";
import * as Bull from "bull";
import { BullMQResponders, BullResponders } from "./responders";
import { Responders } from "./interfaces/responders";
import { Integration } from "./interfaces/integration";

const chalk = require("chalk");

const queueNameRegExp = new RegExp("(.*):(.*):id");
const maxCount = 150000;
const maxTime = 40000;

// We keep a redis client that we can reuse for all the queues.
let redisClients: Record<"bull" | "bullmq", Redis | Cluster> = {} as any;

export interface FoundQueue {
  prefix: string;
  name: string;
  type: QueueType;
}

const scanForQueues = async (node: Redis | Cluster, startTime: number) => {
  let cursor = "0";
  const keys = [];
  do {
    const [nextCursor, scannedKeys] = await node.scan(
      cursor,
      "MATCH",
      "*:*:id",
      "COUNT",
      maxCount,
      "TYPE",
      "string"
    );
    cursor = nextCursor;

    keys.push(...scannedKeys);
  } while (Date.now() - startTime < maxTime && cursor !== "0");

  return keys;
}

const getQueueKeys = async (client: Redis | Cluster, queueNames?: string[]) => {
  let nodes = "nodes" in client ? client.nodes('master') : [client]
  let keys = [];
  const startTime = Date.now();
  const foundQueues = new Set<string>();

  for await (const node of nodes) {

    // If we have proposed queue names, lets check if they exist (including prefix)
    // Basically checking if there is a id key for the queue (prefix:name:id)
    if (queueNames) {

      const queueKeys = queueNames.map((queueName) => {
        // Separate queue name from prefix
        let [prefix, name] = queueName.split(":");
        if (!name) {
          name = prefix;
          prefix = "bull";
        }

        // If the queue name includes a prefix use that, otherwise use the default prefix "bull"
        return `${prefix}:${name}:id`;
      });

      for (const key of queueKeys) {
        const exists = await node.exists(key);
        if (exists) {
          foundQueues.add(key);
        }
      }
      keys.push(...foundQueues);

      // Warn for missing queues
      for (const key of queueKeys) {
        if (!foundQueues.has(key)) {
          // Extract queue name from key
          const match = queueNameRegExp.exec(key);
          console.log(
            chalk.yellow("Redis:") +
            chalk.red(` Queue "${match[1]}:${match[2]}" not found in Redis. Skipping...`)
          );
        }
      }

    } else {
      keys.push(...await scanForQueues(node, startTime));
    }
  }
  return keys;
};

export async function getConnectionQueues(
  redisOpts: RedisOptions,
  clusterNodes?: string[],
  queueNames?: string[]
): Promise<FoundQueue[]> {
  const queues = await execRedisCommand(
    redisOpts,
    async (client) => {
      const keys = await getQueueKeys(client, queueNames);

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
  type: "bull" | "bullmq",
  clusterNodes?: string[]
) {
  if (!redisClients[type]) {
    if (clusterNodes && clusterNodes.length) {
      const { username, password } = redisOptsFromUrl(clusterNodes[0])
      redisClients[type] = new Redis.Cluster(clusterNodes, {
        ...redisOpts,
        redisOptions: {
          username,
          password,
          tls: process.env.REDIS_CLUSTER_TLS ? {
            cert: Buffer.from(process.env.REDIS_CLUSTER_TLS ?? '', 'base64').toString('ascii')
          } : undefined,
        }
      });
    } else {
      redisClients[type] = new Redis(redisOpts);
    }

    redisClients[type].on("error", (err: Error) => {
      console.log(
        `${chalk.yellow("Redis:")} ${chalk.red("redis connection error")} ${err.message
        }`
      );
    });

    redisClients[type].on("connect", () => {
      console.log(
        `${chalk.yellow("Redis:")} ${chalk.green("connected to redis server")}`
      );
    });

    redisClients[type].on("end", () => {
      console.log(
        `${chalk.yellow("Redis:")} ${chalk.blueBright(
          "disconnected from redis server"
        )}`
      );
    });
  }

  return redisClients[type];
}

export async function execRedisCommand(
  redisOpts: RedisOptions,
  cb: (client: Redis | Cluster) => any,
  clusterNodes?: string[]
) {
  const redisClient = getRedisClient(redisOpts, "bull", clusterNodes);

  const result = await cb(redisClient);

  return result;
}

export function createQueue(
  foundQueue: FoundQueue,
  redisOpts: RedisOptions,
  opts: {
    nodes?: string[];
    integrations?: {
      [key: string]: Integration;
    };
  } = {}
): { queue: Bull.Queue | Queue; responders: Responders } {
  const { nodes, integrations } = opts;
  const createClient = function (type: "client" /*, redisOpts */) {
    switch (type) {
      case "client":
        return getRedisClient(redisOpts, "bull", nodes);
      default:
        throw new Error(`Unexpected connection type: ${type}`);
    }
  };

  if (integrations && integrations[foundQueue.type]) {
    const integration = integrations[foundQueue.type];
    return {
      queue: integration.createQueue(foundQueue, redisOpts, nodes),
      responders: integration.responders,
    };
  }

  switch (foundQueue.type) {
    case "bullmq":
      return {
        queue: new Queue(foundQueue.name, {
          connection: getRedisClient(redisOpts, "bullmq", nodes),
          prefix: foundQueue.prefix,
        }),
        responders: BullMQResponders,
      };

    case "bull":
      return {
        queue: new (<any>Bull)(foundQueue.name, {
          createClient,
          prefix: foundQueue.prefix,
        }),
        responders: BullResponders,
      };
    default:
      console.error(
        chalk.red(`ERROR:`) +
        `Unexpected queue type: ${foundQueue.type} for queue ${foundQueue.name}`
      );
  }
}
