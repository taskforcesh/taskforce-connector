import { Queue, createPostgresBackend } from "bullmq-v6";
import { BullMQV6Responders } from "../responders";
import { PostgresConnectionOpts } from "../postgres-validator";

const { DEFAULT_SCHEMA } = require("bullmq-v6/dist/cjs/postgres/migrator");

/**
 * Creates a BullMQ v6 Queue backed by PostgreSQL.
 *
 * IMPORTANT: The caller must validate the schema version via
 * `validatePostgresSchema()` BEFORE calling this function.
 * The connector must never run migrations.
 */
export const createQueue = (
  name: string,
  pgOpts: PostgresConnectionOpts
) => ({
  queue: new Queue(name, {
    connection: {
      host: pgOpts.host,
      port: pgOpts.port || 5432,
      database: pgOpts.database,
      user: pgOpts.user,
      password: pgOpts.password,
      ssl: pgOpts.ssl,
      schema: pgOpts.schema || DEFAULT_SCHEMA,
    } as any,
  }, createPostgresBackend),
  responders: BullMQV6Responders,
});
