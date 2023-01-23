import { Socket, Connection } from "./socket";

export const Connect = (
  name: string,
  token: string,
  connection: Connection,
  team?: string,
  backend: string = "wss://api.taskforce.sh",
) => {
  return Socket(name, backend, token, connection, team);
};
