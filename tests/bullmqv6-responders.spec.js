const { BullMQV6Responders } = require("../dist/responders/bullmqv6-responders");

// Mock WebSocket client
function createMockWs() {
  return {
    send: jest.fn(),
  };
}

// Mock Job
function createMockJob(overrides = {}) {
  return {
    retry: jest.fn().mockResolvedValue(undefined),
    promote: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    moveToFailed: jest.fn().mockResolvedValue(undefined),
    updateData: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// Mock Queue
function createMockQueue(jobOverrides = {}) {
  const mockJob = createMockJob(jobOverrides);
  return {
    _mockJob: mockJob,
    getJob: jest.fn().mockResolvedValue(mockJob),
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 5,
      active: 2,
      completed: 100,
      failed: 3,
      delayed: 1,
    }),
    getMetrics: jest.fn().mockResolvedValue({ meta: {}, data: [] }),
    getDependencies: jest.fn().mockResolvedValue([]),
    getWaiting: jest.fn().mockResolvedValue([]),
    getActive: jest.fn().mockResolvedValue([]),
    getDelayed: jest.fn().mockResolvedValue([]),
    getCompleted: jest.fn().mockResolvedValue([]),
    getFailed: jest.fn().mockResolvedValue([]),
    getJobSchedulers: jest.fn().mockResolvedValue([]),
    getWorkers: jest.fn().mockResolvedValue([{ id: "w1" }, { id: "w2" }]),
    getJobLogs: jest.fn().mockResolvedValue({ count: 1, logs: ["log entry"] }),
    getJobSchedulersCount: jest.fn().mockResolvedValue(5),
    getWaitingCount: jest.fn().mockResolvedValue(10),
    getActiveCount: jest.fn().mockResolvedValue(3),
    getDelayedCount: jest.fn().mockResolvedValue(2),
    getCompletedCount: jest.fn().mockResolvedValue(50),
    getFailedCount: jest.fn().mockResolvedValue(7),
    removeJobScheduler: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(undefined),
    drain: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    isPaused: jest.fn().mockResolvedValue(false),
    obliterate: jest.fn().mockResolvedValue(undefined),
    clean: jest.fn().mockResolvedValue(undefined),
    retryJobs: jest.fn().mockResolvedValue(undefined),
  };
}

function parseResponse(ws) {
  const call = ws.send.mock.calls[0];
  return JSON.parse(call[0]);
}

describe("BullMQV6Responders", () => {
  let ws, queue;

  beforeEach(() => {
    ws = createMockWs();
    queue = createMockQueue();
  });

  describe("respondJobCommand", () => {
    it("should retry a job", async () => {
      await BullMQV6Responders.respondJobCommand(ws, queue, {
        id: "msg-1",
        data: { jobId: "job-123", cmd: "retry" },
      });

      expect(queue.getJob).toHaveBeenCalledWith("job-123");
      expect(queue._mockJob.retry).toHaveBeenCalled();
      expect(ws.send).toHaveBeenCalled();
    });

    it("should promote a job", async () => {
      await BullMQV6Responders.respondJobCommand(ws, queue, {
        id: "msg-1",
        data: { jobId: "job-123", cmd: "promote" },
      });

      expect(queue._mockJob.promote).toHaveBeenCalled();
    });

    it("should remove a job", async () => {
      await BullMQV6Responders.respondJobCommand(ws, queue, {
        id: "msg-1",
        data: { jobId: "job-123", cmd: "remove" },
      });

      expect(queue._mockJob.remove).toHaveBeenCalled();
    });

    it("should handle discard via moveToFailed (v6 removed job.discard())", async () => {
      await BullMQV6Responders.respondJobCommand(ws, queue, {
        id: "msg-1",
        data: { jobId: "job-123", cmd: "discard" },
      });

      // v6 uses moveToFailed instead of discard
      expect(queue._mockJob.moveToFailed).toHaveBeenCalledWith(
        expect.any(Error),
        "0"
      );
      const errorArg = queue._mockJob.moveToFailed.mock.calls[0][0];
      expect(errorArg.message).toBe("Discarded");
    });

    it("should handle moveToFailed command", async () => {
      await BullMQV6Responders.respondJobCommand(ws, queue, {
        id: "msg-1",
        data: { jobId: "job-123", cmd: "moveToFailed" },
      });

      expect(queue._mockJob.moveToFailed).toHaveBeenCalledWith(
        expect.any(Error),
        "0"
      );
      const errorArg = queue._mockJob.moveToFailed.mock.calls[0][0];
      expect(errorArg.message).toBe("Failed manually");
    });

    it("should update job data", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await BullMQV6Responders.respondJobCommand(ws, queue, {
        id: "msg-1",
        data: { jobId: "job-123", cmd: "update", data: { foo: "bar" } },
      });

      expect(queue._mockJob.updateData).toHaveBeenCalledWith({ foo: "bar" });
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should send response with message id", async () => {
      await BullMQV6Responders.respondJobCommand(ws, queue, {
        id: "msg-42",
        data: { jobId: "job-123", cmd: "retry" },
      });

      const response = parseResponse(ws);
      expect(response.id).toBe("msg-42");
    });
  });

  describe("respondQueueCommand", () => {
    it("should get job by id", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "getJob", jobId: "job-456" },
      });

      expect(queue.getJob).toHaveBeenCalledWith("job-456");
      expect(ws.send).toHaveBeenCalled();
    });

    it("should get job counts", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "getJobCounts" },
      });

      expect(queue.getJobCounts).toHaveBeenCalled();
      const response = parseResponse(ws);
      expect(response.data).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
      });
    });

    it("should get job scheduler count via proper v6 method", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "getJobSchedulersCount" },
      });

      // v6 has a proper getJobSchedulersCount() method (no more queue.client + zcard)
      expect(queue.getJobSchedulersCount).toHaveBeenCalled();
      const response = parseResponse(ws);
      expect(response.data).toBe(5);
    });

    it("should handle removeRepeatableByKey via removeJobScheduler", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "removeRepeatableByKey", key: "scheduler-abc" },
      });

      // v6 maps removeRepeatableByKey to removeJobScheduler
      expect(queue.removeJobScheduler).toHaveBeenCalledWith("scheduler-abc");
    });

    it("should handle removeJobScheduler command directly", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "removeJobScheduler", key: "scheduler-xyz" },
      });

      expect(queue.removeJobScheduler).toHaveBeenCalledWith("scheduler-xyz");
    });

    it("should paginate getWaiting", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "getWaiting", start: 0, end: 10 },
      });

      expect(queue.getWaiting).toHaveBeenCalledWith(0, 10, undefined);
    });

    it("should preserve an explicit end of 0 when paginating", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "getWaiting", start: 0, end: 0 },
      });

      expect(queue.getWaiting).toHaveBeenCalledWith(0, 0, undefined);
    });

    it("should paginate getJobSchedulers", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "getJobSchedulers", start: 0, end: 20 },
      });

      expect(queue.getJobSchedulers).toHaveBeenCalledWith(0, 20, undefined);
    });

    it("should paginate getWorkers", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "getWorkers", start: 0, end: 10 },
      });

      expect(queue.getWorkers).toHaveBeenCalledWith(0, 10, undefined);
    });

    it("should get workers count", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "getWorkersCount" },
      });

      expect(queue.getWorkers).toHaveBeenCalled();
      const response = parseResponse(ws);
      expect(response.data).toBe(2);
    });

    it("should add a job", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "add", args: ["myJob", { x: 1 }, { delay: 1000 }] },
      });

      expect(queue.add).toHaveBeenCalledWith("myJob", { x: 1 }, { delay: 1000 });
    });

    it("should empty queue via drain", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "empty" },
      });

      expect(queue.drain).toHaveBeenCalled();
    });

    it("should pause queue", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "pause" },
      });

      expect(queue.pause).toHaveBeenCalled();
    });

    it("should resume queue", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "resume" },
      });

      expect(queue.resume).toHaveBeenCalled();
    });

    it("should check isPaused", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "isPaused" },
      });

      expect(queue.isPaused).toHaveBeenCalled();
      const response = parseResponse(ws);
      expect(response.data).toBe(false);
    });

    it("should obliterate queue", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "obliterate" },
      });

      expect(queue.obliterate).toHaveBeenCalled();
    });

    it("should clean queue with v6 argument order (grace, limit, status)", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "clean", grace: 5000, limit: 100, status: "failed" },
      });

      // v6 responder passes (grace, limit, status) directly - correct v6 order
      expect(queue.clean).toHaveBeenCalledWith(5000, 100, "failed");
    });

    it("should retry jobs", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "retryJobs", status: "failed", count: 10 },
      });

      expect(queue.retryJobs).toHaveBeenCalledWith({ status: "failed", count: 10 });
    });

    it("should get job logs", async () => {
      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "getJobLogs", jobId: "job-1", start: 0, end: 10 },
      });

      expect(queue.getJobLogs).toHaveBeenCalledWith("job-1", 0, 10);
      expect(queue.getJobSchedulersCount).not.toHaveBeenCalled();
      expect(ws.send).toHaveBeenCalledTimes(1);
    });

    it("should get count methods (getWaitingCount, getActiveCount, etc.)", async () => {
      for (const cmd of [
        "getWaitingCount",
        "getActiveCount",
        "getDelayedCount",
        "getCompletedCount",
        "getFailedCount",
      ]) {
        ws = createMockWs();
        await BullMQV6Responders.respondQueueCommand(ws, queue, {
          id: "msg-1",
          data: { cmd },
        });

        expect(queue[cmd]).toHaveBeenCalled();
        expect(ws.send).toHaveBeenCalled();
      }
    });

    it("should handle unknown command gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await BullMQV6Responders.respondQueueCommand(ws, queue, {
        id: "msg-1",
        data: { cmd: "nonExistentCommand" },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Missing command nonExistentCommand")
      );
      consoleSpy.mockRestore();
    });
  });
});
