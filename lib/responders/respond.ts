import { WebSocketClient } from "../ws-autoreconnect";

export const respond = (ws: WebSocketClient, startTime: number, id: string, data: any = {}) => {
  const response = JSON.stringify({
    id,
    data,
  });
  ws.send(response, startTime);
};
