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

export async function updateQueuesCache(redisOpts: RedisOptions) {
  const newQueues = await getConnectionQueues(redisOpts);

  queuesCache = queuesCache || {};

  const oldQueues = Object.keys(queuesCache);
  const newQueuesObject = keyBy(newQueues, "name");

  const toAdd = [];
  const toRemove = [];

  for (let i = 0; i < newQueues.length; i++) {
    const newQueue = newQueues[i];
    const oldQueue = queuesCache[newQueue.name];

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
      var closing = queue.close();
      delete queuesCache[queue.name];
      return closing;
    })
  );

  toAdd.forEach(function (queue: FoundQueue) {
    queuesCache[queue.name] = new Bull(queue.name, {
      prefix: queue.prefix,
      redis: redisOpts,
    });
  });

  return newQueues;
}

const queueNameRegExp = new RegExp("(.*):(.*):id");
async function getConnectionQueues(
  redisOpts: RedisOptions
): Promise<FoundQueue[]> {
  const queues = await execRedisCommand(redisOpts, async (client) => {
    const keys: string[] = await client.keys("*:*:id");
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
  });

  return queues;
}

export async function getRedisInfo(redisOpts: RedisOptions) {
  const info = await execRedisCommand(redisOpts, async (client) => {
    return client.info();
  });

  return info;
}

async function execRedisCommand(
  redisOpts: RedisOptions,
  cb: (client: Redis.Redis) => any
) {
  const redisClient = new Redis(redisOpts);

  redisClient.on("error", (err: Error) => {
    console.log(
      chalk.yellow("Redis:") + chalk.red(" redis connection error "),
      err.message
    );
  });

  redisClient.on("connect", () => {
    console.log(
      chalk.yellow("Redis:") + chalk.green(" connected to redis server")
    );
  });

  redisClient.on("end", () => {
    console.log(
      chalk.yellow("Redis:") +
        chalk.blueBright(" disconnected from redis server")
    );
  });

  const result = await cb(redisClient);

  await redisClient.quit();

  return result;
}
