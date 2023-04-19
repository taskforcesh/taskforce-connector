import { RedisOptions } from "ioredis";
import { FoundQueue } from "../queue-factory";
import { Responders } from "./responders";

export interface Integration {
  responders: Responders;
  createQueue: (
    foundQueue: FoundQueue,
    redisOpts: RedisOptions,
    nodes?: string[]
  ) => any;
}
