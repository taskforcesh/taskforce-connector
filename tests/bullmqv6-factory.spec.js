jest.mock("bullmq-v6", () => {
  class MockQueue {
    constructor(name, opts) {
      this.name = name;
      this.opts = opts;
    }
  }
  return { Queue: MockQueue };
});

const { createQueue } = require("../dist/queue-factory/bullmqv6-factory");
const { BullMQV6Responders } = require("../dist/responders/bullmqv6-responders");

describe("BullMQV6 Factory", () => {
  it("should create a queue with the given name, prefix, and connection", () => {
    const mockConnection = { host: "localhost", port: 6379 };
    const result = createQueue("test-queue", "bull", mockConnection);

    expect(result.queue).toBeDefined();
    expect(result.queue.name).toBe("test-queue");
    expect(result.queue.opts.prefix).toBe("bull");
    expect(result.queue.opts.connection).toBe(mockConnection);
  });

  it("should return BullMQV6Responders", () => {
    const mockConnection = { host: "localhost", port: 6379 };
    const result = createQueue("my-queue", "myprefix", mockConnection);

    expect(result.responders).toBe(BullMQV6Responders);
  });

  it("should pass connection as-is to queue options", () => {
    const mockConnection = {
      host: "redis.example.com",
      port: 6380,
      password: "secret",
    };
    const result = createQueue("secure-queue", "prefix", mockConnection);

    expect(result.queue.opts.connection).toEqual(mockConnection);
  });
});
