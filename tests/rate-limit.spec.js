const { BullMQResponders } = require("../dist/responders/bullmq-responders");
const { BullMQV6Responders } = require("../dist/responders/bullmqv6-responders");
const { BullResponders } = require("../dist/responders/bull-responders");

function createMockWs() {
  return { send: jest.fn() };
}

function parseResponse(ws) {
  return JSON.parse(ws.send.mock.calls[0][0]);
}

describe.each([
  ["BullMQResponders", BullMQResponders],
  ["BullMQV6Responders", BullMQV6Responders],
])("%s getRateLimitStatus", (_name, responders) => {
  let ws;

  beforeEach(() => {
    ws = createMockWs();
  });

  const send = (queue) =>
    responders.respondQueueCommand(ws, queue, {
      id: "msg-1",
      data: { cmd: "getRateLimitStatus" },
    });

  it("uses the global rate limit max when configured", async () => {
    const queue = {
      getGlobalRateLimit: jest
        .fn()
        .mockResolvedValue({ max: 10, duration: 1000 }),
      getRateLimitTtl: jest.fn().mockResolvedValue(750),
    };

    await send(queue);

    expect(queue.getRateLimitTtl).toHaveBeenCalledWith(undefined);
    expect(parseResponse(ws).data).toEqual({
      ttl: 750,
      globalRateLimit: { max: 10, duration: 1000 },
      window: null,
    });
  });

  it("only detects manual rate limits without a global rate limit", async () => {
    const queue = {
      getGlobalRateLimit: jest.fn().mockResolvedValue(null),
      getRateLimitTtl: jest.fn().mockResolvedValue(0),
    };

    await send(queue);

    expect(queue.getRateLimitTtl).toHaveBeenCalledWith(
      Number.MAX_SAFE_INTEGER
    );
    expect(parseResponse(ws).data).toEqual({
      ttl: 0,
      globalRateLimit: null,
      window: null,
    });
  });

  it("reports the measured window of a worker-side limiter", async () => {
    const client = { get: jest.fn().mockResolvedValue("4") };
    const queue = {
      keys: { limiter: "bull:q:limiter" },
      client: Promise.resolve(client),
      getGlobalRateLimit: jest.fn().mockResolvedValue(null),
      getRateLimitTtl: jest
        .fn()
        .mockImplementation(async (maxJobs) => (maxJobs === 1 ? 2500 : 0)),
    };

    await send(queue);

    expect(client.get).toHaveBeenCalledWith("bull:q:limiter");
    expect(parseResponse(ws).data).toEqual({
      ttl: 0,
      globalRateLimit: null,
      window: { count: 4, ttl: 2500 },
    });
  });

  it("reads the Redis client from the backend in BullMQ >= 6", async () => {
    const client = { get: jest.fn().mockResolvedValue("2") };
    const queue = {
      keys: { limiter: "bull:q:limiter" },
      getBackend: () => ({ client: Promise.resolve(client) }),
      getGlobalRateLimit: jest.fn().mockResolvedValue(null),
      getRateLimitTtl: jest
        .fn()
        .mockImplementation(async (maxJobs) => (maxJobs === 1 ? 900 : 0)),
    };

    await send(queue);

    expect(parseResponse(ws).data.window).toEqual({ count: 2, ttl: 900 });
  });

  it("does not report a window for manual rate limits", async () => {
    const client = {
      get: jest.fn().mockResolvedValue(String(Number.MAX_SAFE_INTEGER)),
    };
    const queue = {
      keys: { limiter: "bull:q:limiter" },
      client: Promise.resolve(client),
      getGlobalRateLimit: jest.fn().mockResolvedValue(null),
      getRateLimitTtl: jest.fn().mockResolvedValue(3000),
    };

    await send(queue);

    expect(parseResponse(ws).data).toMatchObject({ ttl: 3000, window: null });
  });

  it("responds null for BullMQ versions without support", async () => {
    await send({ getRateLimitTtl: jest.fn() });
    expect(parseResponse(ws).data).toBeNull();
  });
});

describe("BullResponders getRateLimitStatus", () => {
  it("responds null", async () => {
    const ws = createMockWs();
    await BullResponders.respondQueueCommand(ws, {}, {
      id: "msg-1",
      data: { cmd: "getRateLimitStatus" },
    });
    expect(parseResponse(ws).data).toBeNull();
  });
});

describe.each([
  ["BullMQResponders", BullMQResponders],
  ["BullMQV6Responders", BullMQV6Responders],
])("%s getJobCounts", (_name, responders) => {
  const counts = { waiting: 3, active: 1 };

  const makeQueue = () => ({
    getJobCounts: jest.fn().mockResolvedValue(counts),
    getGlobalRateLimit: jest.fn().mockResolvedValue({ max: 5, duration: 1000 }),
    getRateLimitTtl: jest.fn().mockResolvedValue(400),
  });

  const send = async (queue, data) => {
    const ws = createMockWs();
    await responders.respondQueueCommand(ws, queue, {
      id: "msg-1",
      data: { cmd: "getJobCounts", ...data },
    });
    return parseResponse(ws).data;
  };

  it("only returns the counts by default", async () => {
    const queue = makeQueue();
    expect(await send(queue)).toEqual(counts);
    expect(queue.getRateLimitTtl).not.toHaveBeenCalled();
  });

  it("includes the rate limit status when requested", async () => {
    expect(await send(makeQueue(), { rateLimit: true })).toEqual({
      ...counts,
      rateLimit: {
        ttl: 400,
        globalRateLimit: { max: 5, duration: 1000 },
        window: null,
      },
    });
  });

  it("still returns the counts if the rate limit status fails", async () => {
    const queue = makeQueue();
    queue.getGlobalRateLimit.mockRejectedValue(new Error("boom"));
    expect(await send(queue, { rateLimit: true })).toEqual({
      ...counts,
      rateLimit: null,
    });
  });
});

describe("BullResponders getJobCounts", () => {
  it("reports no rate limit status when requested", async () => {
    const ws = createMockWs();
    const queue = { getJobCounts: jest.fn().mockResolvedValue({ waiting: 1 }) };
    await BullResponders.respondQueueCommand(ws, queue, {
      id: "msg-1",
      data: { cmd: "getJobCounts", rateLimit: true },
    });
    expect(parseResponse(ws).data).toEqual({ waiting: 1, rateLimit: null });
  });
});
