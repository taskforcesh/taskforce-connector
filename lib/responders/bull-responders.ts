import * as Bull from "bull";

import { respond } from "./respond";
import { WebSocketClient } from "../ws-autoreconnect";

function paginate(
  ws: WebSocketClient,
  queue: Bull.Queue,
  messageId: string,
  start: number,
  end: number,
  method: string,
  opts?: {
    excludeData: boolean;
  }
) {
  start = start || 0;
  end = end || -1;
  return (<any>queue)
    [method](start, end, opts)
    .then(function (jobs: Bull.Job[]) {
      respond(ws, Date.now(), messageId, jobs);
    });
}

async function respondJobCommand(
  ws: WebSocketClient,
  queue: Bull.Queue,
  msg: any
) {
  const data = msg.data;
  const startTime = Date.now();
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
    case "moveToFailed":
      await job.moveToFailed({ message: "Failed manually" });
      break;
    case "update":
      await job.update(data.data);
    default:
      console.error(
        `Missing command ${data.cmd}. Too old version of taskforce-connector?`
      );
  }
  respond(ws, startTime, msg.id);
}

async function respondQueueCommand(
  ws: WebSocketClient,
  queue: Bull.Queue,
  msg: any
) {
  const startTime = Date.now();
  const data = msg.data;
  switch (data.cmd) {
    case "getJob":
      const job = await queue.getJob(data.jobId);
      respond(ws, startTime, msg.id, job);
      break;
    case "getJobCounts":
      const jobCounts = await queue.getJobCounts();
      respond(ws, startTime, msg.id, jobCounts);
      break;
    case "getMetrics":
      const metrics = await (<any>queue).getMetrics(
        data.type,
        data.start,
        data.end
      );
      respond(ws, startTime, msg.id, metrics);
      break;
    case "getWaiting":
    case "getActive":
    case "getDelayed":
    case "getCompleted":
    case "getFailed":
    case "getRepeatableJobs":
    case "getWorkers":
      paginate(ws, queue, msg.id, data.start, data.end, data.cmd, data.opts);
      break;

    case "getJobLogs":
      const logs = await queue.getJobLogs(data.jobId, data.start, data.end);
      respond(ws, startTime, msg.id, logs);

    case "getWaitingCount":
    case "getActiveCount":
    case "getDelayedCount":
    case "getCompletedCount":
    case "getFailedCount":
    case "getRepeatableCount":
      const count = await (<any>queue)[data.cmd]();
      respond(ws, startTime, msg.id, count);
      break;
    case "getWorkersCount":
      const workers = await queue.getWorkers();
      respond(ws, startTime, msg.id, workers.length);
      break;
    case "removeRepeatableByKey":
      await queue.removeRepeatableByKey(data.key);
      respond(ws, startTime, msg.id);
      break;
    case "add":
      await queue.add(...(data.args as [string, object, object]));
      respond(ws, startTime, msg.id);
      break;
    case "empty":
      await queue.empty();
      respond(ws, startTime, msg.id);
      break;
    case "pause":
      await queue.pause();
      respond(ws, startTime, msg.id);
      break;
    case "resume":
      await queue.resume();
      respond(ws, startTime, msg.id);
      break;
    case "isPaused":
      const isPaused = await queue.isPaused();
      respond(ws, startTime, msg.id, isPaused);
      break;
    case "obliterate":
      await queue.obliterate();
      respond(ws, startTime, msg.id);
      break;
    case "clean":
      await queue.clean(data.grace, data.status, data.limit);
      respond(ws, startTime, msg.id);
      break;
    case "retryJobs":
      await (<any>queue).retryJobs({
        status: data.status,
        count: data.count,
      });
      respond(ws, startTime, msg.id);
      break;
    default:
      console.error(
        `Missing command ${data.cmd}. Too old version of taskforce-connector?`
      );
      respond(ws, msg.id, null);
  }
}

export const BullResponders = {
  respondJobCommand,
  respondQueueCommand,
};
