const http = require("http");
const {
  refusalForStatus,
  refusalForCloseCode,
  nextBackoff,
  MIN_BACKOFF,
  MAX_BACKOFF,
} = require("../dist/connection-refusal");
const { WebSocketClient } = require("../dist/ws-autoreconnect");

describe("connection refusals", () => {
  it("stops on 401 and keeps retrying slowly on 402 and 403", () => {
    expect(refusalForStatus(401, "Invalid token")).toEqual({
      status: 401,
      action: "stop",
      message: "Invalid token",
    });
    expect(refusalForStatus(402, "No plan").action).toBe("backoff");
    expect(refusalForStatus(403, "Quota").action).toBe("backoff");
    expect(refusalForStatus(500).action).toBe("retry");
  });

  it("has a readable message when the server sends none", () => {
    expect(refusalForStatus(401).message).toContain("invalid, revoked or expired");
    expect(refusalForStatus(402, " ").message).toContain("subscribe");
    expect(refusalForStatus(403).message).toContain("quota");
  });

  it("recognizes the close codes 4401, 4402 and 4403 only", () => {
    expect(refusalForCloseCode(4402, "No plan")).toMatchObject({ status: 402, action: "backoff" });
    expect(refusalForCloseCode(4401)).toMatchObject({ status: 401, action: "stop" });
    expect(refusalForCloseCode(4001)).toBeNull();
    expect(refusalForCloseCode(1006)).toBeNull();
  });

  it("waits one minute, doubling up to ten", () => {
    expect(nextBackoff(0)).toBe(MIN_BACKOFF);
    expect(nextBackoff(MIN_BACKOFF)).toBe(2 * MIN_BACKOFF);
    expect(nextBackoff(MAX_BACKOFF)).toBe(MAX_BACKOFF);
  });
});

describe("WebSocketClient refused by the server", () => {
  let server;
  let url;
  let log;

  beforeAll(async () => {
    server = http.createServer();
    server.on("upgrade", (req, socket) => {
      const status = Number(req.headers["x-status"]);
      const body = req.headers["x-body"] || "";
      socket.end(
        `HTTP/1.1 ${status} Refused\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`
      );
    });
    await new Promise((resolve) => server.listen(0, resolve));
    url = `ws://127.0.0.1:${server.address().port}`;
  });

  afterAll(() => server.close());

  beforeEach(() => {
    log = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    log.mockRestore();
    jest.useRealTimers();
  });

  const refusedWith = (status, body) =>
    new Promise((resolve) => {
      const client = new WebSocketClient();
      const original = client.refused.bind(client);
      client.refused = (refusal) => {
        resolve({ client, refusal });
        original(refusal);
      };
      client.onstop = () => {};
      client.open(url, { headers: { "x-status": String(status), "x-body": body } });
    });

  it("401: shows the server's message and stops", async () => {
    const { client, refusal } = await refusedWith(401, "Invalid token: revoked");

    expect(refusal).toMatchObject({ status: 401, action: "stop", message: "Invalid token: revoked" });
    expect(client.stopped).toBe(true);
    expect(log.mock.calls.flat().join(" ")).toContain("Invalid token: revoked");
  });

  it("402: shows the server's message and retries in a minute", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    const { client, refusal } = await refusedWith(402, "No plan with connections");

    expect(refusal).toMatchObject({ status: 402, action: "backoff" });
    expect(client.backoff).toBe(MIN_BACKOFF);
    expect(log.mock.calls.flat().join(" ")).toContain("retrying in 60s");
    client.stopped = true;
  });
});
