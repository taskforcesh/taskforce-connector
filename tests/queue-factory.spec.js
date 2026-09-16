const { createQueue, getConnectionQueues } = require("../dist/queue-factory");

describe("queue auto discovery", () => {
  const createMockRedisClient = (idKeys, metaKeys) => ({
    scan: jest
      .fn()
      .mockResolvedValueOnce(["0", idKeys])
      .mockResolvedValueOnce(["0", metaKeys]),
    exists: jest.fn().mockResolvedValue(1),
    hget: jest.fn().mockImplementation((_key, field) => {
      if (field === "version") {
        return Promise.resolve("bullmq:5.47.0");
      }
      return Promise.resolve(null);
    }),
  });

  const createMockQueueLookupClient = (exists) => ({
    exists: jest.fn().mockImplementation(exists),
    hget: jest.fn().mockImplementation((_key, field) => {
      if (field === "version") {
        return Promise.resolve("bullmq:5.47.0");
      }
      return Promise.resolve(null);
    }),
  });

  it("discovers queue when only meta key exists", async () => {
    const client = createMockRedisClient([], ["bull:emails:meta"]);

    const queues = await getConnectionQueues(undefined, undefined, undefined, client);

    expect(queues).toHaveLength(1);
    expect(queues[0]).toMatchObject({
      prefix: "bull",
      name: "emails",
      type: "bullmq",
      majorVersion: 5,
      version: "5.47.0",
    });
  });

  it("does not duplicate queue discovered by id and meta keys", async () => {
    const client = createMockRedisClient(
      ["bull:notifications:id"],
      ["bull:notifications:meta"]
    );

    const queues = await getConnectionQueues(undefined, undefined, undefined, client);

    expect(queues).toHaveLength(1);
    expect(queues[0]).toMatchObject({
      prefix: "bull",
      name: "notifications",
    });
    expect(client.exists).toHaveBeenCalledTimes(1);
  });

  it("accepts provided queue names when only the meta key exists", async () => {
    const client = createMockQueueLookupClient((...keys) =>
      Promise.resolve(keys.includes("bull:emails:meta") ? 1 : 0)
    );
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const queues = await getConnectionQueues(
      undefined,
      undefined,
      ["emails"],
      client
    );

    expect(queues).toHaveLength(1);
    expect(queues[0]).toMatchObject({
      prefix: "bull",
      name: "emails",
      type: "bullmq",
      majorVersion: 5,
      version: "5.47.0",
    });
    expect(client.exists).toHaveBeenCalledWith(
      "bull:emails:id",
      "bull:emails:meta"
    );
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("does not duplicate provided queue names across cluster nodes", async () => {
    const node = {
      exists: jest.fn().mockResolvedValue(1),
    };
    const client = {
      nodes: jest.fn().mockReturnValue([node, node]),
      exists: jest.fn().mockResolvedValue(1),
      hget: jest.fn().mockImplementation((_key, field) => {
        if (field === "version") {
          return Promise.resolve("bullmq:5.47.0");
        }
        return Promise.resolve(null);
      }),
    };

    const queues = await getConnectionQueues(
      undefined,
      undefined,
      ["emails"],
      client
    );

    expect(queues).toHaveLength(1);
    expect(queues[0]).toMatchObject({
      prefix: "bull",
      name: "emails",
    });
    expect(node.exists).toHaveBeenCalledTimes(1);
  });

  it("does not fall back to Bull for unsupported BullMQ versions", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const queue = createQueue(
      {
        name: "emails",
        prefix: "bull",
        type: "bullmq",
        majorVersion: 99,
      },
      undefined,
      { redisClient: {} }
    );

    expect(queue).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unexpected major version: 99")
    );

    consoleSpy.mockRestore();
  });
});
