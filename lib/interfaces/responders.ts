import { WebSocketClient } from "../ws-autoreconnect";

export interface Responders {
  respondJobCommand(ws: WebSocketClient, queue: any, msg: any): Promise<void>;
  respondQueueCommand(ws: WebSocketClient, queue: any, msg: any): Promise<void>;
}
