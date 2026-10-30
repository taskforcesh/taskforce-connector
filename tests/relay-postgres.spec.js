const { RelayInspector } = require("../dist/relay");

describe("PostgreSQL RelayInspector", () => {
  it("closes namespace backends before opening the next one", async () => {
    const events = [];
    const inspector = new RelayInspector({
      pgOpts: { host: "localhost", database: "bullmq", user: "bullmq" },
    });
    jest
      .spyOn(inspector, "createBackend")
      .mockImplementation((prefix, namespace) => {
        events.push(`create:${namespace}`);
        return {
          waitUntilReady: jest.fn().mockResolvedValue(undefined),
          getNamespaces: jest.fn().mockResolvedValue(["one", "two"]),
          getCounts: jest.fn().mockResolvedValue({ nodes: 1 }),
          close: jest.fn().mockImplementation(async () => {
            events.push(`close:${namespace}`);
          }),
        };
      });

    await expect(inspector.run({ view: "namespaces" })).resolves.toEqual([
      { prefix: "bullmq", namespace: "one", counts: { nodes: 1 } },
      { prefix: "bullmq", namespace: "two", counts: { nodes: 1 } },
    ]);
    expect(events).toEqual([
      "create:default",
      "close:default",
      "create:one",
      "close:one",
      "create:two",
      "close:two",
    ]);
    await inspector.close();
  });
});
