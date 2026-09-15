const { BullResponders } = require("../dist/responders/bull-responders");
const { BullMQResponders } = require("../dist/responders/bullmq-responders");
const { BullMQV6Responders } = require("../dist/responders/bullmqv6-responders");

describe.each([
  ["Bull", BullResponders],
  ["BullMQ", BullMQResponders],
  ["BullMQ v6", BullMQV6Responders],
])("%s responder pagination", (_name, responders) => {
  let ws;

  beforeEach(() => {
    ws = { send: jest.fn() };
  });

  it("requests and returns only the latest failed job for the monitor", async () => {
    const jobs = [
      { id: "latest", failedReason: "Failed", finishedOn: 2000 },
      { id: "older", failedReason: "Failed", finishedOn: 1000 },
    ];
    const queue = {
      getFailed: jest.fn(async (start, end) =>
        jobs.slice(start, end === -1 ? undefined : end + 1)
      ),
    };

    await responders.respondQueueCommand(ws, queue, {
      id: "monitor-request",
      data: { cmd: "getFailed", start: 0, end: 0 },
    });

    expect(queue.getFailed).toHaveBeenCalledWith(0, 0, undefined);
    expect(ws.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
      id: "monitor-request",
      data: [jobs[0]],
    });
  });

  it.each([
    [undefined, undefined, 0, -1],
    [null, null, 0, -1],
    [0, -1, 0, -1],
    [5, 9, 5, 9],
  ])(
    "preserves pagination defaults and ranges (%s, %s)",
    async (start, end, expectedStart, expectedEnd) => {
      const queue = { getFailed: jest.fn().mockResolvedValue([]) };

      await responders.respondQueueCommand(ws, queue, {
        id: "range-request",
        data: { cmd: "getFailed", start, end },
      });

      expect(queue.getFailed).toHaveBeenCalledWith(
        expectedStart,
        expectedEnd,
        undefined
      );
    }
  );

  it.each(["getWaiting", "getActive", "getDelayed", "getCompleted"])(
    "preserves a zero end index for %s",
    async (cmd) => {
      const queue = { [cmd]: jest.fn().mockResolvedValue([]) };
      const opts = { excludeData: true };

      await responders.respondQueueCommand(ws, queue, {
        id: "single-job",
        data: { cmd, start: 0, end: 0, opts },
      });

      expect(queue[cmd]).toHaveBeenCalledWith(0, 0, opts);
    }
  );

  it("waits for the paginated query and response before completing", async () => {
    let resolveJobs;
    const query = new Promise((resolve) => {
      resolveJobs = resolve;
    });
    const queue = { getFailed: jest.fn().mockReturnValue(query) };
    const completed = jest.fn();
    const pending = responders
      .respondQueueCommand(ws, queue, {
        id: "pending-request",
        data: { cmd: "getFailed", start: 0, end: 0 },
      })
      .then(completed);

    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    expect(ws.send).not.toHaveBeenCalled();

    resolveJobs([]);
    await pending;
    expect(completed).toHaveBeenCalledTimes(1);
    expect(ws.send).toHaveBeenCalledTimes(1);
  });

  it("propagates pagination failures to the calling handler", async () => {
    const error = new Error("Redis query failed");
    const queue = { getFailed: jest.fn().mockRejectedValue(error) };

    await expect(
      responders.respondQueueCommand(ws, queue, {
        id: "failed-request",
        data: { cmd: "getFailed", start: 0, end: 0 },
      })
    ).rejects.toThrow(error);
    expect(ws.send).not.toHaveBeenCalled();
  });
});
