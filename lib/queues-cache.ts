import * as Bull from "bull";
import { Queue } from "bullmq";
import { RedisOptions } from "ioredis";
import { keyBy } from "lodash";
import {
  FoundQueue,
  createQueue,
  getConnectionQueues,
} from "./queue-factory";
import { Responders } from "./responders/responders";

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
    toRemove.map(function ({ queue }: { queue: Bull.Queue<any> | Queue<any> }) {
      const closing = queue.close();
      const name = (<any>queue)["name"] as string;
      delete queuesCache[name];
      return closing;
    })
  );

  toAdd.forEach(function (foundQueue: FoundQueue) {
    const key = queueKey(foundQueue);
    queuesCache[key] = createQueue(
      foundQueue,
      redisOpts,
      nodes
    );
  });

  return newQueues;
}
