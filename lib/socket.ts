import { Redis, Cluster, RedisOptions } from "ioredis";
import { pick } from "lodash";
import { getCache, updateQueuesCache, queueKey } from "./queues-cache";
import { WebSocketClient } from "./ws-autoreconnect";
import {
  FoundQueue,
  RedisConnection,
  execRedisCommand,
  getRedisInfo,
  ping,
} from "./queue-factory";
import { getQueueType, redisOptsFromUrl } from "./utils";
import { Integration } from "./interfaces/integration";
import {
  PostgresConnectionOpts,
  validatePostgresSchema,
  discoverPostgresQueues,
  getPostgresInfo,
  getPostgresQueueType,
} from "./postgres-validator";

const { version } = require(`${__dirname}/../package.json`);

const chalk = require("chalk");

export interface ConnectionOptions {
  port?: number;
  host?: string;
  password?: string;
  db?: number;
  uri?: string;
  tls?: object;
}

export type Connection = ConnectionOptions | RedisConnection;

export const Socket = (
  name: string,
  server: string,
  token: string,
  connection: Connection,
  opts: {
    team?: string;
    nodes?: string[];
    integrations?: {
      [key: string]: Integration;
    };
    queueNames?: string[];
    pgOpts?: PostgresConnectionOpts;
  } = {}
) => {
  const { team, nodes, pgOpts } = opts;
  const ws = new WebSocketClient();
  const redisOpts = isRedisInstance(connection)
    ? undefined
    : redisOptsFromConnection(connection);
  const redisClient = isRedisInstance(connection) ? connection : undefined;

  ws.open(server, {
    headers: {
      Authorization: "Bearer " + token,
      Taskforce: "connector",
    },
  });

  console.log(
    `${chalk.yellow("WebSocket:")} ${chalk.blueBright(
      "opening connection to"
    )} ${chalk.gray("Taskforce.sh")} (${chalk.blueBright(
      server
    )}) ${chalk.blueBright("using token")} ${chalk.gray(maskToken(token))}`
  );

  ws.onopen = function open() {
    console.log(
      chalk.yellow("WebSocket:") +
        chalk.blueBright(" opened connection to ") +
        chalk.gray("Taskforce.sh")
    );
  };

  ws.onerror = function (err) {
    var msg;
    if (err.message === "Unexpected server response: 401") {
      msg =
        "Authorization failed, please check that you are using the correct token from your account page";
    } else {
      msg = err.message;
    }
    console.log(chalk.yellow("WebSocket: ") + chalk.red(msg));
  };

  ws.onmessage = async function incoming(input: string) {
    const startTime = Date.now();

    console.log(
      `${chalk.yellow("WebSocket:")} ${chalk.blueBright("received")} %s`,
      input
    );

    try {
      // The authorization confirmation may arrive either as the legacy plain
      // string "authorized" or as a JSON payload that also carries details
      // about the account/team the token belongs to. We accept both.
      const auth = parseAuthorized(input);
      if (auth) {
        console.log(
          chalk.yellow("WebSocket: ") +
            chalk.green("Succesfully authorized to taskforce.sh service")
        );

        logTargetAccount(auth);

        //
        // Send this connection.
        //
        let queues;
        if (pgOpts) {
          // PostgreSQL backend: validate schema first (never run migrations)
          await validatePostgresSchema(pgOpts);
          queues = await updateQueuesCache(redisOpts, opts, redisClient, pgOpts);
        } else {
          queues = await updateQueuesCache(redisOpts, opts, redisClient);
        }
        console.log(
          `${chalk.yellow("WebSocket:")} ${chalk.green(
            "sending connection:"
          )} ${chalk.blueBright(name)} ${
            team ? chalk.green(" for team ") + chalk.blueBright(team) : ""
          }`
        );
        ws.send(
          JSON.stringify({
            res: "connection",
            cmd: "update",
            queues,
            connection: name,
            team,
            version,
          }),
          startTime
        );
      } else {
        const msg = JSON.parse(input);

        if (!msg.data) {
          console.error(
            chalk.red("WebSocket:") +
              chalk.blueBright(" missing message data "),
            msg
          );
          return;
        }

        const { res, queueName, queuePrefix } = msg.data;

        switch (res) {
          case "connections":
            await respondConnectionCommand(connection, msg);
            break;
          case "queues":
          case "jobs":
            let cache = getCache();
            if (!cache) {
              await updateQueuesCache(redisOpts, opts, redisClient, pgOpts);
              cache = getCache();
              if (!cache) {
                throw new Error("Unable to update queues");
              }
            }
            const cacheEntry =
              cache[
                queueKey({ name: queueName, prefix: queuePrefix || "bull" })
              ];

            if (!cacheEntry || !cacheEntry.queue) {
              ws.send(
                JSON.stringify({
                  id: msg.id,
                  err: "Queue not found",
                }),
                startTime
              );
            } else {
              const { queue, responders } = cacheEntry;
              switch (res) {
                case "queues":
                  await responders.respondQueueCommand(ws, queue, msg);
                  break;
                case "jobs":
                  await responders.respondJobCommand(ws, queue, msg);
                  break;
              }
            }
            break;
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  async function respondConnectionCommand(connection: Connection, msg: any) {
    const startTime = Date.now();

    const data = msg.data;

    switch (data.cmd) {
      case "ping":
        const pong = await ping(redisOpts, nodes, redisClient);
        respond(msg.id, startTime, pong);
        break;
      case "getConnection":
        {
          const queues = await updateQueuesCache(redisOpts, opts, redisClient, pgOpts);

          console.log(
            `${chalk.yellow("WebSocket:")} ${chalk.green(
              "sending connection:"
            )} ${chalk.blueBright(name)} ${
              team ? chalk.green(" for team ") + chalk.blueBright(team) : ""
            }`
          );

          logSendingQueues(queues);

          respond(msg.id, startTime, {
            queues,
            connection: name,
            team,
            version,
          });
        }
        break;
      case "getQueues":
        {
          const queues = await updateQueuesCache(redisOpts, opts, redisClient, pgOpts);

          logSendingQueues(queues);

          respond(msg.id, startTime, queues);
        }
        break;
      case "getInfo":
        {
          const info = pgOpts
            ? await getPostgresInfo(pgOpts)
            : await getRedisInfo(redisOpts, nodes, redisClient);
          respond(msg.id, startTime, info);
        }
        break;

      case "getQueueType":
        {
          const queueType = pgOpts
            ? await getPostgresQueueType(pgOpts, data.name)
            : await execRedisCommand(
                redisOpts,
                (client) => getQueueType(data.name, data.prefix, client),
                nodes,
                redisClient
              );
          respond(msg.id, startTime, { queueType });
        }
        break;
    }
  }

  function logSendingQueues(queues: FoundQueue[]) {
    for (const queue of queues) {
      const { name, prefix, type } = queue;
      console.log(
        `${chalk.yellow("WebSocket:")} ${chalk.blueBright(
          "Sending queue:"
        )} ${chalk.green(name)} ${chalk.blueBright("type:")} ${chalk.green(
          type
        )} ${chalk.blueBright("prefix:")} ${chalk.green(prefix)}`
      );
    }
  }

  function respond(id: string, startTime: number, data: any = {}) {
    const response = JSON.stringify({
      id,
      data,
    });
    ws.send(response, startTime);
  }
};

function isRedisInstance(connection: Connection): connection is RedisConnection {
  return connection instanceof Redis || connection instanceof Cluster;
}
function redisOptsFromConnection(connection: ConnectionOptions): RedisOptions {
  let opts: RedisOptions = {
    ...pick(connection, [
      "host",
      "port",
      "username",
      "password",
      "family",
      "sentinelPassword",
      "db",
      "tls",
      "sentinels",
      "name",
    ]),
  };

  if (connection.uri) {
    opts = { ...opts, ...redisOptsFromUrl(connection.uri) };
  }

  opts.retryStrategy = function (times: number) {
    times = times % 8;
    const delay = Math.round(Math.pow(2, times + 8));
    console.log(chalk.yellow("Redis: ") + `Reconnecting in ${delay} ms`);
    return delay;
  };
  return opts;
}

interface AccountInfo {
  email?: string;
  name?: string;
  account?: string;
  team?: string;
}

interface Authorization {
  account?: AccountInfo;
}

// Returns a partially obfuscated token so the user can verify which token is in
// use without leaking the full secret to logs.
function maskToken(token: string): string {
  if (!token) {
    return "";
  }
  if (token.length <= 8) {
    return "****";
  }
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

// Detects an authorization confirmation. Accepts the legacy plain "authorized"
// string as well as a JSON payload of the form
// `{ res: "authorized", account: { ... } }`. Returns undefined for any other
// message so the regular command handling can take over.
function parseAuthorized(input: string): Authorization | undefined {
  if (input === "authorized") {
    return {};
  }
  try {
    const parsed = JSON.parse(input);
    if (parsed && parsed.res === "authorized") {
      return { account: parsed.account };
    }
  } catch (_err) {
    // Not a JSON message, fall through.
  }
  return undefined;
}

// Logs which account/team the connection was associated with so the user can
// confirm the token points to the expected account. When the server does not
// report account details we print an actionable hint, since a connection that
// silently lands in the wrong account is the most common cause of a connection
// "not showing up" on the dashboard.
function logTargetAccount(auth: Authorization) {
  const account = auth.account;
  const owner = account && (account.name || account.email || account.account);

  if (owner) {
    const email =
      account && account.email && account.email !== owner
        ? chalk.gray(` <${account.email}>`)
        : "";
    const team = account && account.team
      ? `${chalk.green(" team ")}${chalk.blueBright(account.team)}`
      : "";
    console.log(
      `${chalk.yellow("WebSocket:")} ${chalk.green(
        "connection registered to account"
      )} ${chalk.blueBright(owner)}${email}${team}`
    );
  } else {
    console.log(
      `${chalk.yellow("WebSocket:")} ${chalk.gray(
        "The server did not report account details for this token. If the connection does not appear on your dashboard, verify the token belongs to the intended account (https://taskforce.sh/account)."
      )}`
    );
  }
}

