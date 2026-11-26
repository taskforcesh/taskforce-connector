import WebSocket = require("ws");
import chalk = require("chalk");
import { WebsocketError } from "./ws-errors.enum";
import {
  nextBackoff,
  Refusal,
  refusalForCloseCode,
  refusalForStatus,
} from "./connection-refusal";

const HEARTBEAT_INTERVAL = 15000;

export class WebSocketClient {
  private number = 0; // Message number
  private autoReconnectInterval = 5 * 1000; // ms
  private url!: string;
  private opts!: object;
  private instance!: WebSocket;
  private pingTimeout!: NodeJS.Timeout;
  // Wait before retrying after a 402 or 403, growing while they last
  private backoff = 0;
  private stopped = false;

  open(url: string, opts: object) {
    this.url = url;
    this.opts = opts;
    if (this.stopped) {
      return;
    }

    this.instance = new WebSocket(url, opts);
    this.instance.on("open", () => {
      this.backoff = 0;
      this.heartbeat();
      this.onopen();
    });

    // The server refused the handshake: read its status and message
    this.instance.on("unexpected-response", (req: any, res: any) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => (body += chunk));
      res.on("end", () => {
        req.destroy();
        this.instance.removeAllListeners();
        this.refused(refusalForStatus(res.statusCode, body));
      });
    });

    this.instance.on("message", (data: string, flags: object) => {
      this.number++;
      this.onmessage(data, flags, this.number);
    });

    this.instance.on("ping", () => this.heartbeat());

    this.instance.on("close", (codeOrError: number | Error, reason?: Buffer) => {
      clearTimeout(this.pingTimeout);

      const refusal =
        typeof codeOrError === "number"
          ? refusalForCloseCode(codeOrError, reason?.toString())
          : null;
      if (refusal) {
        this.instance.removeAllListeners();
        // The server already sent the full message as data
        this.refused({ ...refusal, message: "" });
        this.onclose(<Error>(<unknown>codeOrError));
        return;
      }

      switch (codeOrError) {
        case WebsocketError.NormalClosure:
          console.log(
            chalk.yellow("WebSocket:") + chalk.blue("normally closed")
          );
          break;

        case 4000:
          console.log(
            chalk.yellow("WebSocket:") + chalk.red(" Invalid authentication")
          );
          break;
        default:
          // Abnormal closure
          this.reconnect(<Error>codeOrError);
          break;
      }
      this.onclose(<Error>codeOrError);
    });
    this.instance.on("error", (err: any) => {
      switch (err["code"]) {
        case "ECONNREFUSED":
          break;
        default:
          this.onerror(err);
          break;
      }
    });
  }

  send(data: string, startTime: number, option?: {
    mask?: boolean;
    binary?: boolean;
    compress?: boolean;
    fin?: boolean;
  }) {
    try {
      this.instance.send(data, option || {}, (err?: Error) => {
        if (err) {
          console.log(
            `${chalk.yellow("WebSocket:")} ${chalk.red("send error", err)}`
          );
        } else {
          console.log(
            `${chalk.yellow("WebSocket:")} ${chalk.blue("data sent successfully in")} ${chalk.green(
              Date.now() - startTime)}ms`
          );
        }
      });
    } catch (err) {
      this.instance.emit("error", err);
    }
  }

  /**
   * Stops on 401 (the token can't work), retries more and more slowly on 402
   * and 403 (subscribing or freeing a connection fixes them), and normally
   * otherwise.
   */
  refused(refusal: Refusal) {
    if (refusal.message) {
      console.log(chalk.yellow("WebSocket: ") + chalk.red(refusal.message));
    }
    switch (refusal.action) {
      case "stop":
        this.stopped = true;
        console.log(
          chalk.yellow("WebSocket: ") +
            chalk.red("Not retrying: fix the token and restart the connector.")
        );
        this.onstop(refusal);
        break;
      case "backoff":
        this.backoff = nextBackoff(this.backoff);
        console.log(
          chalk.yellow("WebSocket: ") +
            chalk.blue(`retrying in ${Math.round(this.backoff / 1000)}s`)
        );
        setTimeout(() => this.open(this.url, this.opts), this.backoff);
        break;
      default:
        this.reconnect(new Error(refusal.message));
    }
  }

  reconnect(err: Error) {
    var msg = err.message || "";
    console.log(
      chalk.yellow("WebSocket:") +
      chalk.red(` ${msg} retry in ${this.autoReconnectInterval}ms`)
    );
    this.instance.removeAllListeners();
    setTimeout(() => {
      console.log("WebSocket: reconnecting...");
      this.open(this.url, this.opts);
    }, this.autoReconnectInterval);
  }

  onopen() {
    console.log("WebSocket: open", arguments);
  }

  heartbeat() {
    clearTimeout(this.pingTimeout);

    this.pingTimeout = setTimeout(() => {
      this.instance.terminate();
    }, HEARTBEAT_INTERVAL);
  }

  onmessage = function (data: string, flags: object, num: number) {
    console.log("WebSocket: message", data, flags, num);
  };
  onerror = function (e: Error) {
    console.log("WebSocket: error", arguments);
  };
  // Called when the connector stops retrying (401)
  onstop = function (_refusal: Refusal) {};
  onclose = function (e: Error) {
    console.log("WebSocket: closed", arguments);
  };
}
