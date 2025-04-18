import { Queue } from "bullmq-v3";
import { Redis } from "ioredis";
import { BullMQResponders } from "../responders";

export const createQueue = (
  name: string,
  prefix: string,
  connection: Redis,
) => ({
  queue: new Queue(name, {
    connection,
    prefix,
  }),
  responders: BullMQResponders,
});
