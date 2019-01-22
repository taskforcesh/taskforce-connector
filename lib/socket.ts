import { WebSocketClient } from "./ws-autoreconnect";
import * as Bull from "bull";

const Redis = require("ioredis");
const _ = require("lodash");
const chalk = require("chalk");

interface Connection {
  port: number;
  host: string;
  password: string;
}

module.exports = (
  name: string,
  server: string,
  token: string,
  connection: Connection
) => {
  const ws = new WebSocketClient();

  ws.open(server, {
    headers: {
      Authorization: "Bearer " + token,
      Taskforce: "connector"
    }
  });

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
    if (err.message === "Unexpected server response (401)") {
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
        chalk.yellow("WebSocket: ") +
          chalk.green("sending connection: ") +
          chalk.blue(name)
      );
      ws.send(
        JSON.stringify({
          res: "connection",
          cmd: "update",
          queues: queues,
          connection: name
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
    connection: object
  ): Promise<FoundQueue[]> {
    const redisClient = new Redis(
      _.pick(connection, ["port", "host", "family", "password", "db"]),
      {
        retryStrategy: function(times: number) {
          times = times % 8;
          const delay = Math.round(Math.pow(2, times + 8));
          console.log(
            chalk.yellow("WebSocket: ") + `Reconnecting in ${delay} ms`
          );
          return delay;
        }
      }
    );

    redisClient.on("error", (err: Error) => {
      console.log(
        chalk.yellow("WebSocket:") + chalk.red(" redis connection error "),
        err.message
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
        redis: connection,
        prefix: queue.prefix
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
      ws.send(
        JSON.stringify({
          id: messageId,
          data: jobs
        })
      );
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

    ws.send(
      JSON.stringify({
        id: msg.id
      })
    );
  }

  async function respondQueueCommand(queue: Bull.Queue, msg: any) {
    const data = msg.data;
    switch (data.cmd) {
      case "getJob":
        const job = await queue.getJob(data.jobId);
        ws.send(
          JSON.stringify({
            id: msg.id,
            data: job
          })
        );
        break;
      case "getJobCounts":
        const jobCounts = await queue.getJobCounts();
        ws.send(
          JSON.stringify({
            id: msg.id,
            data: jobCounts
          })
        );
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
        ws.send(
          JSON.stringify({
            id: msg.id,
            data: count
          })
        );
        break;
      case "removeRepeatableByKey":
      console.log('Whatsa?', data)
        await (<any>queue).removeRepeatableByKey(data.key);

        ws.send(
          JSON.stringify({
            id: msg.id
          })
        );
        break;
    }
  }

  async function respondConnectionCommand(connection: Connection, msg: any) {
    const data = msg.data;
    const queues = await getConnectionQueues(connection);
    switch (data.cmd) {
      case "getConnection":
        console.log(
          chalk.yellow("WebSocket: ") +
            chalk.green("sending connection: ") +
            chalk.blue(name)
        );
        ws.send(
          JSON.stringify({
            id: msg.id,
            data: {
              queues: queues,
              connection: name
            }
          })
        );
        break;
      case "getQueues":
        await updateQueueCache(queues);
        console.log(
          chalk.yellow("WebSocket:") + chalk.blue(" sending queues "),
          queues
        );

        ws.send(
          JSON.stringify({
            id: msg.id,
            data: queues
          })
        );
        break;
    }
  }
};
