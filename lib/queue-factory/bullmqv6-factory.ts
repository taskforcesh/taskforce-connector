import { Queue } from "bullmq-v6";
import { Redis } from "ioredis";
import { BullMQV6Responders } from "../responders";

export const createQueue = (
  name: string,
  prefix: string,
  connection: Redis
) => ({
  queue: new Queue(name, {
    connection: connection as any,
    prefix,
  }),
  responders: BullMQV6Responders,
});
