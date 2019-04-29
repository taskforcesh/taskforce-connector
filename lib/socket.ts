import { WebSocketClient } from "./ws-autoreconnect";
import * as Bull from "bull";

import * as url from "url";
import { RedisOptions, Redis } from "ioredis";

const Redis = require("ioredis");
const _ = require("lodash");
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
      Taskforce: "connector"
    }
  });

  console.log(
    chalk.yellow("WebSocket:") +
      chalk.blue(" opening connection to ") +
      chalk.gray("Taskforce.sh")
  );

  const queues: { [index: string]: Bull.Queue } = {};

  ws.onopen = function open() {
    console.log(
      chalk.yellow("WebSocket:") +
        chalk.blue(" opened connection to ") +
        chalk.gray("Taskforce.sh")
    );
  };

  ws.onerror = function(err) {
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
    console.log(chalk.yellow("WebSocket:") + chalk.blue(" received"), input);
    if (input === "authorized") {
      console.log(
        chalk.yellow("WebSocket: ") +
          chalk.green("Succesfully authorized to taskforce.sh service")
      );

      //
      // Send this connection.
      //
      const queues = await getConnectionQueues(connection);
      console.log(
        `${chalk.yellow("WebSocket: ")} ${chalk.green(
          "sending connection: "
        )} ${chalk.blue(name)} ${
          team ? chalk.green(" for team ") + chalk.blue(team) : ""
        }`
      );
      ws.send(
        JSON.stringify({
          res: "connection",
          cmd: "update",
          queues,
          connection: name,
          team
        })
      );
      return;
    }
    const msg = JSON.parse(input);

    if (!msg.data) {
      console.error(
        chalk.red("WebSocket:") + chalk.blue(" missing message data "),
        msg
      );
      return;
    }

    const data = msg.data;
    const res = data.res;

    switch (res) {
      case "connections":
        respondConnectionCommand(connection, msg);
        break;
      case "queues":
      case "jobs":
        var queue = queues[data.queueName];

        if (!queue) {
          ws.send(
            JSON.stringify({
              id: msg.id,
              err: "Queue not found"
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
  };

  interface FoundQueue {
    prefix: string;
    name: string;
  }

  const queueNameRegExp = new RegExp("(.*):(.*):id");
  async function getConnectionQueues(
    connection: Connection
  ): Promise<FoundQueue[]> {
    const redisClient = new Redis(redisOpts);

    redisClient.on("error", (err: Error) => {
      console.log(
        chalk.yellow("Redis:") + chalk.red(" redis connection error "),
        err.message
      );
    });

    redisClient.on("connect", () => {
      console.log(
        chalk.yellow("Redis:") + chalk.green(" connected to redis server")
      );
    });

    redisClient.on("end", () => {
      console.log(
        chalk.yellow("Redis:") + chalk.blue(" disconnected from redis server")
      );
    });

    const keys: string[] = await redisClient.keys("*:*:id");
    const queues = keys.map(function(key) {
      var match = queueNameRegExp.exec(key);
      if (match) {
        return {
          prefix: match[1],
          name: match[2]
        };
      }
    });

    await redisClient.quit();

    return queues;
  }

  async function updateQueueCache(newQueues: FoundQueue[]) {
    const oldQueues = Object.keys(queues);
    const toRemove = _.difference(oldQueues, newQueues);
    const toAdd = _.difference(newQueues, oldQueues);

    await Promise.all(
      toRemove.map(function(queueName: string) {
        var closing = queues[queueName].close();
        delete queues[queueName];
        return closing;
      })
    );

    toAdd.forEach(function(queue: FoundQueue) {
      queues[queue.name] = new Bull(queue.name, {
        prefix: queue.prefix,
        redis: redisOpts
      });
    });
  }

  function paginate(
    queue: Bull.Queue,
    messageId: string,
    start: number,
    end: number,
    method: string,
    ws: WebSocketClient
  ) {
    start = start || 0;
    end = end || -1;
    return (<any>queue)[method](start, end).then(function(jobs: Bull.Job[]) {
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
        paginate(queue, msg.id, data.start, data.end, data.cmd, ws);
        break;

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
    }
  }

  async function respondConnectionCommand(connection: Connection, msg: any) {
    const data = msg.data;
    const queues = await getConnectionQueues(connection);
    switch (data.cmd) {
      case "getConnection":
        console.log(
          `${chalk.yellow("WebSocket: ")} ${chalk.green(
            "sending connections: "
          )} ${chalk.blue(name)} ${
            team ? chalk.green(" for team ") + chalk.blue(team) : ""
          }`
        );

        respond(msg.id, {
          queues,
          connection: name,
          team
        });
        break;
      case "getQueues":
        await updateQueueCache(queues);
        console.log(
          chalk.yellow("WebSocket:") + chalk.blue(" sending queues "),
          queues
        );

        respond(msg.id, queues);

        break;
    }
  }

  function respond(id: string, data: any = {}) {
    const response = JSON.stringify({
      id,
      data
    });
    ws.send(response);
  }
};

function redisOptsFromConnection(connection: Connection): RedisOptions {
  let opts: RedisOptions = {
    ..._.pick(connection, ["port", "host", "family", "password", "db", "tls"])
  };

  if (connection.uri) {
    opts = { ...opts, ...redisOptsFromUrl(connection.uri) };
  }

  opts.retryStrategy = function(times: number) {
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
