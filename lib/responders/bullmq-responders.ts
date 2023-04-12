import { Queue, Job } from "bullmq";

import { respond } from "./respond";
import { WebSocketClient } from "../ws-autoreconnect";

function paginate(
  ws: WebSocketClient,
  queue: Queue,
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
  return (<any>queue)[method](start, end, opts).then(function (jobs: Job[]) {
    respond(ws, messageId, jobs);
  });
}

async function respondJobCommand(ws: WebSocketClient, queue: Queue, msg: any) {
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
    case "moveToFailed":
      await job.moveToFailed(new Error("Failed manually"), "0");
      break;
    case "update":
      await job.update(data.data);
    default:
      console.error(
        `Missing command ${data.cmd}. Too old version of taskforce-connector?`
      );
  }
  respond(ws, msg.id);
}

async function respondQueueCommand(
  ws: WebSocketClient,
  queue: Queue,
  msg: any
) {
  const data = msg.data;
  switch (data.cmd) {
    case "getJob":
      const job = await queue.getJob(data.jobId);
      respond(ws, msg.id, job);
      break;
    case "getJobCounts":
      const jobCounts = await queue.getJobCounts();
      respond(ws, msg.id, jobCounts);
      break;
    case "getMetrics":
      const metrics = await (<any>queue).getMetrics(
        data.type,
        data.start,
        data.end
      );
      respond(ws, msg.id, metrics);
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
      respond(ws, msg.id, logs);

    case "getWaitingCount":
    case "getActiveCount":
    case "getDelayedCount":
    case "getCompletedCount":
    case "getFailedCount":
    case "getRepeatableCount":
    case "getWorkersCount":
      const count = await (<any>queue)[data.cmd]();
      respond(ws, msg.id, count);
      break;
    case "removeRepeatableByKey":
      await queue.removeRepeatableByKey(data.key);
      respond(ws, msg.id);
      break;
    case "add":
      await queue.add(...(data.args as [string, object, object]));
      respond(ws, msg.id);
      break;
    case "empty":
      await queue.drain();
      respond(ws, msg.id);
      break;
    case "pause":
      await queue.pause();
      respond(ws, msg.id);
      break;
    case "resume":
      await queue.resume();
      respond(ws, msg.id);
      break;
    case "isPaused":
      const isPaused = await queue.isPaused();
      respond(ws, msg.id, isPaused);
      break;
    case "obliterate":
      await queue.obliterate();
      respond(ws, msg.id);
      break;
    case "clean":
      await queue.clean(data.grace, data.status, data.limit);
      respond(ws, msg.id);
      break;
    case "retryJobs":
      await (<any>queue).retryJobs({
        status: data.status,
        count: data.count,
      });
      respond(ws, msg.id);
      break;
    default:
      console.error(
        `Missing command ${data.cmd}. Too old version of taskforce-connector?`
      );
      respond(ws, msg.id, null);
  }
}

export const BullMQResponders = {
  respondJobCommand,
  respondQueueCommand,
};
