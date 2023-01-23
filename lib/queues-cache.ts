import * as Bull from "bull";
import { RedisOptions } from "ioredis";
import { keyBy } from "lodash";
import * as Redis from "ioredis";

const chalk = require("chalk");

let queuesCache: { [index: string]: Bull.Queue } = null;

export const getCache = () => {
  return queuesCache;
};

export interface FoundQueue {
  prefix: string;
  name: string;
}

// We keep a redis client that we can reuse for all the queues.
let redisClient: Redis.Redis | Redis.Cluster;

export async function updateQueuesCache(
  redisOpts: RedisOptions,
  nodes?: string[]
) {
  const newQueues = await getConnectionQueues(redisOpts, nodes);

  queuesCache = queuesCache || {};

  const oldQueues = Object.keys(queuesCache);
  const newQueuesObject = keyBy(newQueues, (queue) => queueKey(queue));

  const toAdd = [];
  const toRemove = [];

  for (let i = 0; i < newQueues.length; i++) {
    const newQueue = newQueues[i];
    const oldQueue = queuesCache[queueKey(newQueue)];

    if (!oldQueue) {
      toAdd.push(newQueue);
    }
  }

  for (let i = 0; i < oldQueues.length; i++) {
    const oldQueue = oldQueues[i];
    const newQueue = newQueuesObject[oldQueue];

    if (!newQueue) {
      toRemove.push(queuesCache[oldQueue]);
    }
  }

  await Promise.all(
    toRemove.map(function (queue: Bull.Queue<any>) {
      const closing = queue.close();
      const name = (<any>queue)["name"] as string;
      delete queuesCache[name];
      return closing;
    })
  );

  const createClient = function (type: "client" /*, redisOpts */) {
    switch (type) {
      case "client":
        return getRedisClient(redisOpts, nodes);
      default:
        throw new Error(`Unexpected connection type: ${type}`);
    }
  };

  toAdd.forEach(function (queue: FoundQueue) {
    queuesCache[queueKey(queue)] = new Bull(queue.name, {
      createClient,
      prefix: queue.prefix,
    });
  });

  return newQueues;
}

const queueNameRegExp = new RegExp("(.*):(.*):id");
const maxCount = 50000;
const maxTime = 30000;

const getQueueKeys = async (client: Redis.Redis | Redis.Cluster) => {
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

async function getConnectionQueues(
  redisOpts: RedisOptions,
  clusterNodes?: string[]
): Promise<FoundQueue[]> {
  const queues = await execRedisCommand(
    redisOpts,
    async (client) => {
      const keys = await getQueueKeys(client);

      const queues = keys.map(function (key) {
        var match = queueNameRegExp.exec(key);
        if (match) {
          return {
            prefix: match[1],
            name: match[2],
          };
        }
      });
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

function getRedisClient(redisOpts: RedisOptions, clusterNodes?: string[]) {
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

async function execRedisCommand(
  redisOpts: RedisOptions,
  cb: (client: Redis.Redis | Redis.Cluster) => any,
  clusterNodes?: string[]
) {
  const redisClient = getRedisClient(redisOpts, clusterNodes);

  const result = await cb(redisClient);

  return result;
}

export function queueKey(queue: FoundQueue) {
  return `${queue.prefix}:${queue.name}`;
}
