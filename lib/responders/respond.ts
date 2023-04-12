import { WebSocketClient } from "../ws-autoreconnect";

export const respond = (ws: WebSocketClient, id: string, data: any = {}) => {
  const response = JSON.stringify({
    id,
    data,
  });
  ws.send(response);
};
