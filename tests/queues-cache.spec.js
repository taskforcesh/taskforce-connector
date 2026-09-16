jest.mock("../dist/queue-factory", () => ({
  createQueue: jest.fn(),
  getConnectionQueues: jest.fn(),
}));

const { createQueue, getConnectionQueues } = require("../dist/queue-factory");
const { getCache, updateQueuesCache } = require("../dist/queues-cache");

describe("queues-cache", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const cache = getCache();
    if (cache) {
      Object.keys(cache).forEach((key) => delete cache[key]);
    }
  });

  it("removes stale queues by cache key", async () => {
    const closeAlpha = jest.fn().mockResolvedValue(undefined);
    const closeBeta = jest.fn().mockResolvedValue(undefined);

    getConnectionQueues
      .mockResolvedValueOnce([
        { prefix: "alpha", name: "shared", type: "bull", majorVersion: 0 },
        { prefix: "beta", name: "shared", type: "bull", majorVersion: 0 },
      ])
      .mockResolvedValueOnce([
        { prefix: "beta", name: "shared", type: "bull", majorVersion: 0 },
      ]);

    createQueue
      .mockReturnValueOnce({
        queue: { name: "shared", close: closeAlpha },
        responders: {},
      })
      .mockReturnValueOnce({
        queue: { name: "shared", close: closeBeta },
        responders: {},
      });

    await updateQueuesCache(undefined);
    await updateQueuesCache(undefined);

    expect(closeAlpha).toHaveBeenCalled();
    expect(closeBeta).not.toHaveBeenCalled();
    expect(Object.keys(getCache())).toEqual(["beta:shared"]);
  });
});
