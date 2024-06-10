import * as Bull from "bull";
import { Queue } from "bullmq";
import { RedisOptions } from "ioredis";
import { keyBy } from "lodash";
import { FoundQueue, createQueue, getConnectionQueues } from "./queue-factory";
import { Responders } from "./interfaces/responders";
import { Integration } from "./interfaces/integration";

let queuesCache: {
  [index: string]: { queue: Bull.Queue | Queue; responders: Responders };
} = null;

export const getCache = () => {
  return queuesCache;
};

export function queueKey(queue: Omit<FoundQueue, "type">) {
  return `${queue.prefix}:${queue.name}`;
}

export async function updateQueuesCache(
  redisOpts: RedisOptions,
  opts: {
    nodes?: string[];
    integrations?: {
      [key: string]: Integration;
    };
    queueNames?: string[];
  } = {}
) {
  const { nodes, integrations, queueNames } = opts;
  const newQueues = await getConnectionQueues(redisOpts, nodes, queueNames);

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
      delete queuesCache[name];
      return closing;
    })
  );

  toAdd.forEach(function (foundQueue: FoundQueue) {
    const key = queueKey(foundQueue);
    const queue = createQueue(foundQueue, redisOpts, { nodes, integrations });
    if (queue) {
      queuesCache[key] = queue;
    }
  });

  return newQueues.filter((queue) => !!queuesCache[queueKey(queue)]);
}
