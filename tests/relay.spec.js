const { randomUUID } = require("crypto");
const IORedis = require("ioredis");
const { Relay } = require("bullmq-v6");
const { RelayInspector } = require("../dist/relay");

const host = process.env.REDIS_HOST || "localhost";

describe("RelayInspector", () => {
  const prefix = `tfc-relay-${randomUUID().slice(0, 8)}`;
  const namespace = "orders";
  let client;
  let inspector;
  const relays = [];

  beforeAll(async () => {
    client = new IORedis({ host });
    for (const name of ["api", "worker"]) {
      const relay = new Relay({
        connection: { host },
        prefix,
        namespace,
        name,
      });
      relays.push(relay);
      await relay.waitUntilReady();
    }
    await relays[0].subscribe("jobs.*.cancel", () => undefined);
    await relays[1].subscribe("config.workers", () => undefined);
    await relays[0].publish("config.workers", { concurrency: 4 }, {
      retain: 60000,
    });
    inspector = new RelayInspector({ redisClient: client });
  });

  afterAll(async () => {
    await inspector.close();
    await Promise.all(relays.map((relay) => relay.close()));
    const keys = await client.keys(`${prefix}::relay:*`);
    if (keys.length) {
      await client.del(...keys);
    }
    await client.quit();
  });

  it("lists namespaces with their counts", async () => {
    expect(
      await inspector.run({ view: "namespaces", prefixes: [prefix, "none"] })
    ).toEqual([
      {
        prefix,
        namespace,
        counts: { nodes: 2, subscriptions: 2, patterns: 2, retained: 1 },
      },
    ]);
  });

  it("answers every view of a namespace", async () => {
    const run = (view, extra = {}) =>
      inspector.run({ view, prefix, namespace, start: 0, end: 9, ...extra });

    expect((await run("nodes")).map((node) => node.info.name)).toEqual([
      "api",
      "worker",
    ]);
    expect(await run("patterns")).toEqual([
      { pattern: "config.workers", subscriptions: 1 },
      { pattern: "jobs.*.cancel", subscriptions: 1 },
    ]);
    expect(
      await run("subscriptions", { nodeId: relays[0].nodeId })
    ).toEqual([
      {
        nodeId: relays[0].nodeId,
        endpointId: expect.any(String),
        pattern: "jobs.*.cancel",
      },
    ]);
    expect(await run("retained")).toMatchObject([{ topic: "config.workers" }]);
    expect(await run("counts")).toMatchObject({ nodes: 2 });
  });

  it("caps pages at 100 items", async () => {
    const backend = await inspector.getBackend(prefix, namespace);
    const getNodes = jest.spyOn(backend, "getNodes");
    await inspector.run({
      view: "nodes",
      prefix,
      namespace,
      start: 10,
      end: 100000,
    });
    expect(getNodes).toHaveBeenCalledWith(10, 109);
  });

  it("runs actions", async () => {
    const received = [];
    await relays[1].subscribe("dashboard.test", (message) => {
      received.push(message.data);
    });
    expect(
      await inspector.runAction({
        action: "publish",
        prefix,
        namespace,
        topic: "dashboard.test",
        data: JSON.stringify({ hello: "relay" }),
        retainMs: 60000,
      })
    ).toMatchObject({ nodes: 1, endpoints: 1 });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(received).toEqual([{ hello: "relay" }]);
    expect(
      await inspector.runAction({
        action: "deleteRetained",
        prefix,
        namespace,
        topic: "dashboard.test",
      })
    ).toEqual({ deleted: true });
    expect(
      await inspector.runAction({ action: "sweep", prefix, namespace })
    ).toEqual({ removed: [] });
    await expect(
      inspector.runAction({ action: "drop", prefix, namespace })
    ).rejects.toThrow("Unknown relay action");
  });

  it("rejects unknown views", async () => {
    await expect(
      inspector.run({ view: "keys", prefix, namespace })
    ).rejects.toThrow("Unknown relay view");
  });
});
