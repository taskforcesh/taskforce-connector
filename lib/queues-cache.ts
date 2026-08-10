import * as Bull from "bull";
import { Queue } from "bullmq";
import { RedisOptions } from "ioredis";
import { keyBy } from "lodash";
import {
  FoundQueue,
  RedisConnection,
  createQueue,
  getConnectionQueues,
} from "./queue-factory";
import { Responders } from "./interfaces/responders";
import { Integration } from "./interfaces/integration";
import { PostgresConnectionOpts, discoverPostgresQueues } from "./postgres-validator";

let queuesCache: {
  [index: string]: { queue: Bull.Queue | Queue; responders: Responders };
} | null = null;

export const getCache = () => {
  return queuesCache;
};

export function queueKey(
  queue: Omit<FoundQueue, "type" | "majorVersion" | "version">
) {
  return `${queue.prefix}:${queue.name}`;
}

export async function updateQueuesCache(
  redisOpts: RedisOptions | undefined,
  opts: {
    nodes?: string[];
    integrations?: {
      [key: string]: Integration;
    };
    queueNames?: string[];
  } = {},
  redisClient?: RedisConnection,
  pgOpts?: PostgresConnectionOpts
) {
  const { nodes, integrations, queueNames } = opts;

  let newQueues: FoundQueue[];
  if (pgOpts) {
    // PostgreSQL backend: discover queues from PG meta table
    const pgQueueNames = queueNames || (await discoverPostgresQueues(pgOpts));
    newQueues = pgQueueNames.map((name) => ({
      prefix: "bullmq", // PG doesn't use Redis-style prefixes
      name,
      type: "bullmq" as any,
      majorVersion: 6,
    }));
  } else {
    newQueues = await getConnectionQueues(
      redisOpts,
      nodes,
      queueNames,
      redisClient
    );
  }

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
    toRemove.map(function ({ queue }: { queue: Bull.Queue<any> | Queue<any> }) {
      const closing = queue.close();
      const name = (<any>queue)["name"] as string;
      delete queuesCache![name];
      return closing;
    })
  );

  toAdd.forEach(function (foundQueue: FoundQueue) {
    const key = queueKey(foundQueue);
    let queue;
    if (pgOpts && foundQueue.majorVersion === 6) {
      const { createQueue: createPgQueue } = require("./queue-factory/bullmqv6-postgres-factory");
      queue = createPgQueue(foundQueue.name, pgOpts);
    } else {
      queue = createQueue(foundQueue, redisOpts, {
        nodes,
        integrations,
        redisClient,
      });
    }
    if (queue) {
      queuesCache![key] = queue;
    }
  });

  return newQueues.filter((queue) => !!queuesCache![queueKey(queue)]);
}
