import * as WebSocket from "ws";
import chalk from "chalk";

export class WebSocketClient {
  private number = 0; // Message number
  private autoReconnectInterval = 5 * 1000; // ms
  private url: string;
  private opts: object;
  private instance: any;

  open(url: string, opts: object) {
    this.url = url;
    this.opts = opts;

    this.instance = new WebSocket(url, opts);
    this.instance.on("open", () => {
      this.onopen();
    });

    this.instance.on("message", (data: string, flags: object) => {
      this.number++;
      this.onmessage(data, flags, this.number);
    });

    this.instance.on("close", (codeOrError: number | Error) => {
      switch (codeOrError) {
        case 1000: // CLOSE_NORMAL
          console.log(chalk.yellow("WebSocket:") + chalk.blue(" closed"));
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
          this.reconnect(err);
          break;
        default:
          this.onerror(err);
          break;
      }
    });
  }

  send(data: string, option?: object) {
    try {
      this.instance.send(data, option);
    } catch (err) {
      this.instance.emit("error", err);
    }
  }

  reconnect(err: Error) {
    var msg = err.message || "";
    console.log(
      chalk.yellow("WebSocket:") +
        chalk.red(` ${msg} retry in ${this.autoReconnectInterval}ms`)
    );
    this.instance.removeAllListeners();
    var _this = this;
    setTimeout(function() {
      console.log("WebSocket: reconnecting...");
      _this.open(_this.url, _this.opts);
    }, this.autoReconnectInterval);
  }

  onopen() {
    console.log("WebSocket: open", arguments);
  }

  onmessage = function(data: string, flags: object, num: number) {
    console.log("WebSocket: message", data, flags, num);
  };
  onerror = function(e: Error) {
    console.log("WebSocket: error", arguments);
  };
  onclose = function(e: Error) {
    console.log("WebSocket: closed", arguments);
  };
}
