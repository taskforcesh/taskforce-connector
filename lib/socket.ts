import * as Bull from "bull";
import { RedisOptions } from "ioredis";
import { pick } from "lodash";
import * as url from "url";
import { getCache, updateQueuesCache } from "./queues-cache";
import { WebSocketClient } from "./ws-autoreconnect";

const chalk = require("chalk");

interface Connection {
  port?: number;
  host?: string;
  password?: string;
  db?: number;
  uri?: string;
  tls?: object;
}

module.exports = (
  name: string,
  server: string,
  token: string,
  connection: Connection,
  team?: string
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
      chalk.yellow("WebSocket:") + chalk.blueBright(" received"),
      input
    );
    if (input === "authorized") {
      console.log(
        chalk.yellow("WebSocket: ") +
          chalk.green("Succesfully authorized to taskforce.sh service")
      );

      //
      // Send this connection.
      //
      const queues = await updateQueuesCache(redisOpts);
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
        })
      );
    } else {
      const msg = JSON.parse(input);

      if (!msg.data) {
        console.error(
          chalk.red("WebSocket:") + chalk.blueBright(" missing message data "),
          msg
        );
        return;
      }

      const { res, queueName } = msg.data;

      switch (res) {
        case "connections":
          respondConnectionCommand(connection, msg);
          break;
        case "queues":
        case "jobs":
          const cache = getCache();
          if (!cache) {
            await updateQueuesCache(redisOpts);
          }
          var queue = cache[queueName];

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
                respondQueueCommand(queue, msg);
                break;
              case "jobs":
                respondJobCommand(queue, msg);
                break;
            }
          }
          break;
      }
    }
  };

  function paginate(
    queue: Bull.Queue,
    messageId: string,
    start: number,
    end: number,
    method: string
  ) {
    start = start || 0;
    end = end || -1;
    return (<any>queue)[method](start, end).then(function (jobs: Bull.Job[]) {
      respond(messageId, jobs);
    });
  }

  async function respondJobCommand(queue: Bull.Queue, msg: any) {
    const data = msg.data;
    const job = await queue.getJob(data.jobId);

    switch (data.cmd) {
      case "retry":
        await job.retry();
        break;
      case "promote":
        await job.promote();
        break;
      case "remove":
        await job.remove();
        break;
      case "discard":
        await job.discard();
        break;
    }

    respond(msg.id);
  }

  async function respondQueueCommand(queue: Bull.Queue, msg: any) {
    const data = msg.data;
    switch (data.cmd) {
      case "getJob":
        const job = await queue.getJob(data.jobId);
        respond(msg.id, job);
        break;
      case "getJobCounts":
        const jobCounts = await queue.getJobCounts();
        respond(msg.id, jobCounts);
        break;
      case "getWaiting":
      case "getActive":
      case "getDelayed":
      case "getCompleted":
      case "getFailed":
      case "getRepeatableJobs":
      case "getWorkers":
        paginate(queue, msg.id, data.start, data.end, data.cmd);
        break;

      case "getJobLogs":
        const logs = await (<any>queue).getJobLogs(
          data.jobId,
          data.start,
          data.end
        );
        respond(msg.id, logs);

      case "getWaitingCount":
      case "getActiveCount":
      case "getDelayedCount":
      case "getCompletedCount":
      case "getFailedCount":
      case "getRepeatableCount":
      case "getWorkersCount":
        const count = await (<any>queue)[data.cmd]();
        respond(msg.id, count);
        break;
      case "removeRepeatableByKey":
        await (<any>queue).removeRepeatableByKey(data.key);
        respond(msg.id);
        break;
      case "empty":
        await queue.empty();
        respond(msg.id);
        break;
      default:
        console.error(
          `Missing command ${data.cmd}. Too old version of taskforce-connector?`
        );
        respond(msg.id, null);
    }
  }

  async function respondConnectionCommand(connection: Connection, msg: any) {
    const data = msg.data;
    const queues = await updateQueuesCache(redisOpts);
    switch (data.cmd) {
      case "getConnection":
        console.log(
          `${chalk.yellow("WebSocket: ")} ${chalk.green(
            "sending connections: "
          )} ${chalk.blueBright(name)} ${
            team ? chalk.green(" for team ") + chalk.blueBright(team) : ""
          }`
        );

        respond(msg.id, {
          queues,
          connection: name,
          team,
        });
        break;
      case "getQueues":
        console.log(
          chalk.yellow("WebSocket:") + chalk.blueBright(" sending queues "),
          queues
        );

        respond(msg.id, queues);

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
    ...pick(connection, ["port", "host", "family", "password", "db", "tls"]),
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
