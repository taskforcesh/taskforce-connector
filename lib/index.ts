import { Socket, Connection } from "./socket";

export const Connect = (
  name: string,
  token: string,
  connection: Connection,
  team?: string
) => {
  return Socket(name, "wss://api.taskforce.sh", token, connection, team);
};
