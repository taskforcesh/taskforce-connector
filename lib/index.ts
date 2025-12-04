import { Integration } from "./interfaces/integration";
import { Socket, Connection } from "./socket";

export { Integration } from "./interfaces/integration";
export { getRedisClient, FoundQueue, RedisConnection } from "./queue-factory";
export { WebSocketClient } from "./ws-autoreconnect";
export { Connection, ConnectionOptions } from "./socket";
export { respond } from "./responders/respond";
export { BullMQResponders } from "./responders/bullmq-responders";

export { versionChecker } from "./version-checker";
export { Socket } from "./socket";

export const Connect = (
  name: string,
  token: string,
  connection: Connection,
  backend: string = "wss://api.taskforce.sh",
  opts: {
    team?: string;
    integrations?: { [key: string]: Integration };
    nodes?: string[];
    queueNames?: string[];
  } = {}
) => {
  return Socket(name, backend, token, connection, opts);
};
