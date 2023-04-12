import { RedisOptions } from "ioredis";
import { pick } from "lodash";
import * as url from "url";
import { getCache, updateQueuesCache, queueKey } from "./queues-cache";
import { WebSocketClient } from "./ws-autoreconnect";
import { execRedisCommand, getRedisInfo, ping } from "./queue-factory";
import { getQueueType } from "./utils";

const { version } = require(`${__dirname}/../package.json`);

const chalk = require("chalk");

export interface Connection {
  port?: number;
  host?: string;
  password?: string;
  db?: number;
  uri?: string;
  tls?: object;
}

export const Socket = (
  name: string,
  server: string,
  token: string,
  connection: Connection,
  team?: string,
  nodes?: string[]
) => {
  const ws = new WebSocketClient();
  const redisOpts = redisOptsFromConnection(connection);

  ws.open(server, {
    headers: {
      Authorization: "Bearer " + token,
      Taskforce: "connector",
    },
  });

  console.log(
    chalk.yellow("WebSocket:") +
      chalk.blueBright(" opening connection to ") +
      chalk.gray("Taskforce.sh")
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
    console.log(
      `${chalk.yellow("WebSocket:")} ${chalk.blueBright("received")} %s`,
      input
    );

    try {
      if (input === "authorized") {
        console.log(
          chalk.yellow("WebSocket: ") +
            chalk.green("Succesfully authorized to taskforce.sh service")
        );

        //
        // Send this connection.
        //
        const queues = await updateQueuesCache(redisOpts, nodes);
        console.log(
          `${chalk.yellow("WebSocket: ")} ${chalk.green(
            "sending connection: "
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
          })
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
            const cache = getCache();
            if (!cache) {
              await updateQueuesCache(redisOpts, nodes);
            }
            const { queue, responders } =
              cache[
                queueKey({ name: queueName, prefix: queuePrefix || "bull" })
              ];

            if (!queue) {
              ws.send(
                JSON.stringify({
                  id: msg.id,
                  err: "Queue not found",
                })
              );
            } else {
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
    const data = msg.data;
    switch (data.cmd) {
      case "ping":
        const pong = await ping(redisOpts, nodes);
        respond(msg.id, pong);
        break;
      case "getConnection":
        {
          const queues = await updateQueuesCache(redisOpts, nodes);

          console.log(
            `${chalk.yellow("WebSocket: ")} ${chalk.green(
              "sending connection:"
            )} ${chalk.blueBright(name)} ${
              team ? chalk.green(" for team ") + chalk.blueBright(team) : ""
            }`
          );

          respond(msg.id, {
            queues,
            connection: name,
            team,
            version,
          });
        }
        break;
      case "getQueues":
        {
          const queues = await updateQueuesCache(redisOpts, nodes);

          console.log(
            `${chalk.yellow("WebSocket:")} ${chalk.blueBright(
              " sending queues "
            )}`,
            queues
          );

          respond(msg.id, queues);
        }
        break;
      case "getInfo":
        const info = await getRedisInfo(redisOpts, nodes);
        respond(msg.id, info);
        break;

      case "getQueueType":
        const queueType = await execRedisCommand(
          redisOpts,
          (client) => getQueueType(data.name, data.prefix, client),
          nodes
        );
        respond(msg.id, { queueType });
        break;
    }
  }

  function respond(id: string, data: any = {}) {
    const response = JSON.stringify({
      id,
      data,
    });
    ws.send(response);
  }
};

function redisOptsFromConnection(connection: Connection): RedisOptions {
  let opts: RedisOptions = {
    ...pick(connection, [
      "port",
      "host",
      "family",
      "password",
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

function redisOptsFromUrl(urlString: string) {
  const redisOpts: RedisOptions = {};
  try {
    const redisUrl = url.parse(urlString);
    redisOpts.port = parseInt(redisUrl.port) || 6379;
    redisOpts.host = redisUrl.hostname;
    redisOpts.db = redisUrl.pathname
      ? parseInt(redisUrl.pathname.split("/")[1])
      : 0;
    if (redisUrl.auth) {
      redisOpts.password = redisUrl.auth.split(":")[1];
    }
  } catch (e) {
    throw new Error(e.message);
  }
  return redisOpts;
}
