// Must mock pg before requiring the validator
jest.mock("pg", () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn().mockResolvedValue(undefined),
  };
  return {
    Pool: jest.fn(() => mockPool),
    __mockPool: mockPool,
    __mockClient: mockClient,
  };
});

// Mock bullmq-v6 internal modules
jest.mock("bullmq-v6/dist/cjs/postgres/migrations", () => ({
  LATEST_SCHEMA_VERSION: 2,
}));

jest.mock("bullmq-v6/dist/cjs/postgres/migrator", () => ({
  DEFAULT_SCHEMA: "bullmq",
  quoteSchemaName: (s) => `"${s}"`,
}));

const pg = require("pg");
const {
  validatePostgresSchema,
  discoverPostgresQueues,
} = require("../dist/postgres-validator");

const mockClient = pg.__mockClient;

const defaultOpts = {
  host: "localhost",
  port: 5432,
  database: "testdb",
  user: "testuser",
  password: "testpass",
};

describe("validatePostgresSchema", () => {
  let mockExit;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExit = jest.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  it("should exit if BullMQ schema does not exist", async () => {
    mockClient.query
      // Schema existence check
      .mockResolvedValueOnce({ rows: [] });

    await expect(validatePostgresSchema(defaultOpts)).rejects.toThrow(
      "process.exit(1)"
    );

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should exit if migration table does not exist", async () => {
    mockClient.query
      // Schema exists
      .mockResolvedValueOnce({ rows: [{ schema_name: "bullmq" }] })
      // Migration table does NOT exist
      .mockResolvedValueOnce({ rows: [{ exists: false }] });

    await expect(validatePostgresSchema(defaultOpts)).rejects.toThrow(
      "process.exit(1)"
    );

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should exit if schema version is 0 (no migrations applied)", async () => {
    mockClient.query
      // Schema exists
      .mockResolvedValueOnce({ rows: [{ schema_name: "bullmq" }] })
      // Migration table exists
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      // SET search_path
      .mockResolvedValueOnce({})
      // Version is 0
      .mockResolvedValueOnce({ rows: [{ version: 0 }] });

    await expect(validatePostgresSchema(defaultOpts)).rejects.toThrow(
      "process.exit(1)"
    );

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should exit if schema version is older than expected", async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ schema_name: "bullmq" }] })
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({})
      // Version is 1, expected is 2
      .mockResolvedValueOnce({ rows: [{ version: 1 }] });

    await expect(validatePostgresSchema(defaultOpts)).rejects.toThrow(
      "process.exit(1)"
    );

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should exit if schema version is newer than supported", async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ schema_name: "bullmq" }] })
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({})
      // Version is 99, expected is 2
      .mockResolvedValueOnce({ rows: [{ version: 99 }] });

    await expect(validatePostgresSchema(defaultOpts)).rejects.toThrow(
      "process.exit(1)"
    );

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should succeed when schema version matches LATEST_SCHEMA_VERSION", async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ schema_name: "bullmq" }] })
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({})
      // Version matches (2)
      .mockResolvedValueOnce({ rows: [{ version: 2 }] });

    const result = await validatePostgresSchema(defaultOpts);

    expect(result).toBe(2);
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should exit on connection error", async () => {
    const pgModule = require("pg");
    pgModule.__mockPool.connect.mockRejectedValueOnce(
      Object.assign(new Error("Connection refused"), { code: "ECONNREFUSED" })
    );

    await expect(validatePostgresSchema(defaultOpts)).rejects.toThrow(
      "process.exit(1)"
    );

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should use custom schema when provided", async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ schema_name: "custom" }] })
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ version: 2 }] });

    const opts = { ...defaultOpts, schema: "custom" };
    const result = await validatePostgresSchema(opts);

    expect(result).toBe(2);
    // Check that schema was passed to the query
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("schema_name"),
      ["custom"]
    );
  });

  it("should always release client and end pool", async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ schema_name: "bullmq" }] })
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ version: 2 }] });

    await validatePostgresSchema(defaultOpts);

    expect(mockClient.release).toHaveBeenCalled();
    expect(pg.__mockPool.end).toHaveBeenCalled();
  });
});

describe("discoverPostgresQueues", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return queue names from the meta table", async () => {
    mockClient.query
      // SET search_path
      .mockResolvedValueOnce({})
      // SELECT DISTINCT queue
      .mockResolvedValueOnce({
        rows: [
          { queue: "emails" },
          { queue: "notifications" },
          { queue: "payments" },
        ],
      });

    const queues = await discoverPostgresQueues(defaultOpts);

    expect(queues).toEqual(["emails", "notifications", "payments"]);
  });

  it("should return empty array when no queues exist", async () => {
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] });

    const queues = await discoverPostgresQueues(defaultOpts);

    expect(queues).toEqual([]);
  });
});
