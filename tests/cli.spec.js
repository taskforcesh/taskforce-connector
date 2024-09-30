const { program } = require("commander");
const { before } = require("lodash");
const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});
const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

describe("CLI Options", () => {
  beforeAll(() => {
    process.env.TASKFORCE_TOKEN = "1234567890";
  });

  afterEach(() => {
    delete process.env.TASKFORCE_TOKEN;
    jest.clearAllMocks();
  });

  it("should use environment variable for nodes if set", () => {
    process.env.REDIS_NODES = "node1:6379,node2:6379";
    require("../app.js"); // Update the path as necessary

    expect(program.nodes).toEqual(["node1:6379", "node2:6379"]);
  });

  it("should use default port if no environment variable is set", () => {
    delete process.env.REDIS_PORT;
    require("../app.js"); // Update the path as necessary

    expect(program.port).toBe("6379");
  });

  // Add more tests for each option and scenario...
});
