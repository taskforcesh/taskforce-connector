import { RedisOptions } from "ioredis";
import {
  createPostgresRelayBackend,
  createRedisRelayBackend,
} from "bullmq-v6";
import type { IRelayBackend } from "bullmq-v6";
import { RedisConnection, getRedisClient } from "./queue-factory";
import { PostgresConnectionOpts } from "./postgres-validator";

const { DEFAULT_SCHEMA } = require("bullmq-v6/dist/cjs/postgres/migrator");

/**
 * Relay (BullMQ 6 fleet messaging) inspection for Taskforce.sh: answers the
 * `getRelay` command with the read-only getters of BullMQ's relay backends
 * (one Lua script or SQL function call per view). The request is validated
 * by Taskforce.sh; it is checked again here.
 */

type RelayView =
  | "namespaces"
  | "counts"
  | "nodes"
  | "subscriptions"
  | "patterns"
  | "retained";

export interface RelayRequest {
  view: RelayView;
  prefixes?: string[];
  prefix?: string;
  namespace?: string;
  start?: number;
  end?: number;
  nodeId?: string;
  pattern?: string;
}

const MAX_NAMESPACES = 100;
const MAX_PAGE_SIZE = 100;
const MAX_BACKENDS = 200;

export class RelayInspector {
  private backends = new Map<string, Promise<IRelayBackend>>();

  constructor(
    private opts: {
      redisOpts?: RedisOptions;
      nodes?: string[];
      redisClient?: RedisConnection;
      pgOpts?: PostgresConnectionOpts;
    }
  ) {}

  async run(request: RelayRequest): Promise<unknown> {
    const { view, prefix, namespace } = request;
    const start = Math.max(0, Number(request.start) || 0);
    const requestedEnd =
      Number.isInteger(request.end) && request.end! >= 0
        ? request.end!
        : start + MAX_PAGE_SIZE - 1;
    const end = Math.min(
      requestedEnd,
      start + MAX_PAGE_SIZE - 1
    );

    if (view === "namespaces") {
      // PostgreSQL has no key prefixes: its namespaces live in the schema.
      const prefixes = this.opts.pgOpts
        ? [this.opts.pgOpts.schema || DEFAULT_SCHEMA]
        : request.prefixes || [];
      const result = [];
      for (const candidate of prefixes) {
        const registry = await this.getBackend(candidate, "default");
        const names = (await registry.getNamespaces()).slice(
          0,
          MAX_NAMESPACES
        );
        for (const name of names) {
          const backend = await this.getBackend(candidate, name);
          result.push({
            prefix: candidate,
            namespace: name,
            counts: await backend.getCounts(),
          });
        }
      }
      return result;
    }

    if (!prefix || !namespace) {
      throw new Error("Missing relay prefix or namespace");
    }
    const backend = await this.getBackend(prefix, namespace);
    switch (view) {
      case "counts":
        return backend.getCounts();
      case "nodes":
        return backend.getNodes(start, end);
      case "subscriptions":
        return backend.getSubscriptions(
          request.nodeId !== undefined
            ? { nodeId: request.nodeId }
            : request.pattern !== undefined
            ? { pattern: request.pattern }
            : undefined,
          start,
          end
        );
      case "patterns":
        return backend.getPatterns(start, end);
      case "retained":
        return backend.getRetained(start, end);
      default:
        throw new Error(`Unknown relay view: ${view}`);
    }
  }

  /**
   * Runs an action requested by Taskforce.sh (which validated it and checked
   * the user's permissions): publish, delete a retained message, sweep.
   */
  async runAction(action: RelayAction): Promise<unknown> {
    const backend = await this.getBackend(action.prefix, action.namespace);
    switch (action.action) {
      case "publish":
        return backend.publish(action.topic, action.data, {
          ts: Date.now(),
          retainMs: action.retainMs,
          maxSize: MAX_PUBLISH_BYTES,
        });
      case "deleteRetained":
        return { deleted: await backend.deleteRetained(action.topic) };
      case "sweep":
        return { removed: await backend.sweep(100) };
      default:
        throw new Error(`Unknown relay action: ${(action as any).action}`);
    }
  }

  async close() {
    const backends = [...this.backends.values()];
    this.backends.clear();
    await Promise.all(
      backends.map((backend) =>
        backend.then((instance) => instance.close()).catch(() => undefined)
      )
    );
  }

  private getBackend(prefix: string, namespace: string) {
    const key = `${prefix}\u0000${namespace}`;
    let backend = this.backends.get(key);
    if (backend) {
      this.backends.delete(key);
      this.backends.set(key, backend);
      return backend;
    }
    backend = (async () => {
      const instance = this.createBackend(prefix, namespace);
      try {
        await instance.waitUntilReady();
      } catch (error) {
        try {
          await instance.close();
        } catch {}
        throw error;
      }
      return instance;
    })();
    backend.catch(() => this.backends.delete(key));
    this.backends.set(key, backend);
    if (this.backends.size > MAX_BACKENDS) {
      const [oldestKey, oldest] = this.backends.entries().next().value!;
      this.backends.delete(oldestKey);
      oldest.then((instance) => instance.close()).catch(() => undefined);
    }
    return backend;
  }

  private createBackend(prefix: string, namespace: string): IRelayBackend {
    const { pgOpts } = this.opts;
    if (pgOpts) {
      return createPostgresRelayBackend({
        connection: {
          host: pgOpts.host,
          port: pgOpts.port || 5432,
          database: pgOpts.database,
          user: pgOpts.user,
          password: pgOpts.password,
          ssl: pgOpts.ssl,
          schema: pgOpts.schema || DEFAULT_SCHEMA,
          // The getters need a single connection.
          max: 1,
        } as any,
        namespace,
      });
    }
    // Shares the connector's cached client: a backend used only for its
    // getters opens no connection of its own.
    return createRedisRelayBackend({
      connection: getRedisClient(
        this.opts.redisOpts,
        "bullmq",
        this.opts.nodes,
        this.opts.redisClient
      ) as any,
      prefix,
      namespace,
    });
  }
}

export type RelayAction =
  | {
      action: "publish";
      prefix: string;
      namespace: string;
      topic: string;
      data: string;
      retainMs: number;
    }
  | { action: "deleteRetained"; prefix: string; namespace: string; topic: string }
  | { action: "sweep"; prefix: string; namespace: string };

const MAX_PUBLISH_BYTES = 512 * 1024;
