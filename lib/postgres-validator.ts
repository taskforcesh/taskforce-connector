import { Pool, PoolConfig } from "pg";

const chalk = require("chalk");

/**
 * PostgreSQL connection options for the connector.
 */
export interface PostgresConnectionOpts {
  host: string;
  port?: number;
  database: string;
  user: string;
  password?: string;
  schema?: string;
  ssl?: boolean | object;
}

/**
 * Validates that the BullMQ PostgreSQL schema exists and is at the expected version.
 * The connector must NEVER run migrations — it should fail fast if the schema is
 * missing or at an incompatible version.
 *
 * @returns The current schema version if valid.
 * @throws Exits the process if schema is invalid.
 */
export async function validatePostgresSchema(
  opts: PostgresConnectionOpts
): Promise<number> {
  const {
    LATEST_SCHEMA_VERSION,
  } = require("bullmq-v6/dist/cjs/postgres/migrations");
  const {
    DEFAULT_SCHEMA,
    quoteSchemaName,
  } = require("bullmq-v6/dist/cjs/postgres/migrator");

  const schema = opts.schema || DEFAULT_SCHEMA;
  const quotedSchema = quoteSchemaName(schema);

  const poolConfig: PoolConfig = {
    host: opts.host,
    port: opts.port || 5432,
    database: opts.database,
    user: opts.user,
    password: opts.password,
    ssl: opts.ssl,
    max: 1, // Only need one connection for validation
  };

  const pool = new Pool(poolConfig);
  let client;

  try {
    client = await pool.connect();

    // Check if the BullMQ schema exists
    const schemaResult = await client.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [schema]
    );

    if (schemaResult.rows.length === 0) {
      console.error(
        chalk.red("ERROR:") +
          ` BullMQ PostgreSQL schema "${schema}" does not exist.\n` +
          `The connector does not run migrations. Please initialize the database schema ` +
          `using the BullMQ migration tool or by running a Worker/Queue instance first.`
      );
      process.exit(1);
    }

    // Check if the migration ledger table exists
    const tableResult = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = 'migration'
      ) AS exists`,
      [schema]
    );

    if (!tableResult.rows[0].exists) {
      console.error(
        chalk.red("ERROR:") +
          ` BullMQ migration table not found in schema "${schema}".\n` +
          `The database schema appears uninitialized. Please run migrations ` +
          `using the BullMQ migration tool or by running a Worker/Queue instance first.`
      );
      process.exit(1);
    }

    // Check the current schema version
    await client.query(`SET search_path TO ${quotedSchema}`);
    const versionResult = await client.query(
      `SELECT COALESCE(MAX(version), 0)::int AS version FROM migration`
    );
    const currentVersion = versionResult.rows[0]?.version ?? 0;

    if (currentVersion === 0) {
      console.error(
        chalk.red("ERROR:") +
          ` BullMQ schema "${schema}" has no migrations applied (version 0).\n` +
          `The connector requires schema version ${LATEST_SCHEMA_VERSION}. ` +
          `Please run migrations using the BullMQ migration tool first.`
      );
      process.exit(1);
    }

    if (currentVersion < LATEST_SCHEMA_VERSION) {
      console.error(
        chalk.red("ERROR:") +
          ` BullMQ schema version mismatch: found v${currentVersion}, ` +
          `expected v${LATEST_SCHEMA_VERSION}.\n` +
          `The connector does not run migrations. Please upgrade the schema ` +
          `using the BullMQ migration tool or by running a Worker/Queue instance first.`
      );
      process.exit(1);
    }

    if (currentVersion > LATEST_SCHEMA_VERSION) {
      console.error(
        chalk.red("ERROR:") +
          ` BullMQ schema version mismatch: found v${currentVersion}, ` +
          `but this connector only supports up to v${LATEST_SCHEMA_VERSION}.\n` +
          `Please upgrade the taskforce-connector to a version compatible with ` +
          `this BullMQ schema.`
      );
      process.exit(1);
    }

    console.log(
      chalk.green("PostgreSQL:") +
        ` Schema "${schema}" validated (version ${currentVersion})`
    );

    return currentVersion;
  } catch (err: any) {
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      console.error(
        chalk.red("ERROR:") +
          ` Cannot connect to PostgreSQL at ${opts.host}:${opts.port || 5432}: ${err.message}`
      );
      process.exit(1);
    }
    // Re-throw unexpected errors (process.exit calls above handle known cases)
    throw err;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

/**
 * Discovers queues from the BullMQ PostgreSQL schema by querying the meta table.
 */
export async function discoverPostgresQueues(
  opts: PostgresConnectionOpts
): Promise<string[]> {
  const { DEFAULT_SCHEMA, quoteSchemaName } = require("bullmq-v6/dist/cjs/postgres/migrator");

  const schema = opts.schema || DEFAULT_SCHEMA;
  const quotedSchema = quoteSchemaName(schema);

  const poolConfig: PoolConfig = {
    host: opts.host,
    port: opts.port || 5432,
    database: opts.database,
    user: opts.user,
    password: opts.password,
    ssl: opts.ssl,
    max: 1,
  };

  const pool = new Pool(poolConfig);
  let client;

  try {
    client = await pool.connect();
    await client.query(`SET search_path TO ${quotedSchema}`);

    const result = await client.query(
      `SELECT DISTINCT queue FROM meta ORDER BY queue`
    );

    return result.rows.map((row: { queue: string }) => row.queue);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}


/**
 * Gathers high-level information about the PostgreSQL server backing a BullMQ
 * connection, mirroring the Redis INFO bar shown in the dashboard.
 *
 * Returns a structured payload discriminated by `backend: "postgres"` so the
 * backend/frontend can render a PostgreSQL-specific info bar instead of Redis.
 */
export interface PostgresInfo {
  backend: "postgres";
  server_version: string;
  database: string;
  schema: string;
  db_size: number;
  connected_clients: number;
  max_connections: number;
}

/**
 * Determines the queue type/version for a PostgreSQL-backed BullMQ queue by
 * reading the `version` entry from the schema's `meta` table (stored as
 * `bullmq:<version>` / `bullmq-pro:<version>`, mirroring the Redis convention).
 *
 * PostgreSQL is only supported by BullMQ v6+, so this never returns a "bull"
 * type. When the version cannot be read, it falls back to BullMQ v6.
 */
export async function getPostgresQueueType(
  opts: PostgresConnectionOpts,
  queueName: string
): Promise<{ type: "bullmq" | "bullmq-pro"; majorVersion: number; version?: string }> {
  const { DEFAULT_SCHEMA, quoteSchemaName } = require("bullmq-v6/dist/cjs/postgres/migrator");
  const schema = opts.schema || DEFAULT_SCHEMA;
  const quotedSchema = quoteSchemaName(schema);

  const poolConfig: PoolConfig = {
    host: opts.host,
    port: opts.port || 5432,
    database: opts.database,
    user: opts.user,
    password: opts.password,
    ssl: opts.ssl,
    max: 1,
  };

  const pool = new Pool(poolConfig);
  let client;

  try {
    client = await pool.connect();
    await client.query(`SET search_path TO ${quotedSchema}`);

    const result = await client.query(
      `SELECT value FROM meta WHERE queue = $1 AND field = 'version' LIMIT 1`,
      [queueName]
    );

    const longVersion: string | undefined = result.rows[0]?.value;
    if (longVersion) {
      const type = longVersion.includes("bullmq-pro") ? "bullmq-pro" : "bullmq";
      const version = longVersion.split(":")[1] || "";
      const majorVersionStr = version.split(".")[0];
      const majorVersion = majorVersionStr ? parseInt(majorVersionStr, 10) : 6;
      return { type, majorVersion, version };
    }

    // No version recorded yet: it is still a PostgreSQL (BullMQ v6+) queue.
    return { type: "bullmq", majorVersion: 6 };
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

export async function getPostgresInfo(
  opts: PostgresConnectionOpts
): Promise<PostgresInfo> {
  const { DEFAULT_SCHEMA } = require("bullmq-v6/dist/cjs/postgres/migrator");
  const schema = opts.schema || DEFAULT_SCHEMA;

  const poolConfig: PoolConfig = {
    host: opts.host,
    port: opts.port || 5432,
    database: opts.database,
    user: opts.user,
    password: opts.password,
    ssl: opts.ssl,
    max: 1,
  };

  const pool = new Pool(poolConfig);
  let client;

  try {
    client = await pool.connect();

    // A single pg client cannot run queries in parallel, so issue them
    // sequentially.
    const versionRes = await client.query("SHOW server_version");
    const sizeRes = await client.query(
      "SELECT pg_database_size(current_database())::bigint AS size"
    );
    const maxConnRes = await client.query("SHOW max_connections");
    const activeRes = await client.query(
      "SELECT count(*)::int AS active FROM pg_stat_activity WHERE datname = current_database()"
    );

    return {
      backend: "postgres",
      server_version: versionRes.rows[0]?.server_version ?? "unknown",
      database: opts.database,
      schema,
      db_size: Number(sizeRes.rows[0]?.size ?? 0),
      connected_clients: activeRes.rows[0]?.active ?? 0,
      max_connections: Number(maxConnRes.rows[0]?.max_connections ?? 0),
    };
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}
