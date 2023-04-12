import { WebSocketClient } from "../ws-autoreconnect";
import { Queue } from "bullmq";
import * as Bull from "bull";

export interface Responders {
  respondJobCommand(
    ws: WebSocketClient,
    queue: Bull.Queue | Queue,
    msg: any
  ): Promise<void>;
  respondQueueCommand(
    ws: WebSocketClient,
    queue: Bull.Queue | Queue,
    msg: any
  ): Promise<void>;
}
