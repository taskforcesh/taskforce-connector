const { getConnectionQueues } = require("../dist/queue-factory");

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
});
