import { Command, Option } from "commander";
import { blueBright, red } from "chalk";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

import { Socket } from "./socket";
import { versionChecker } from "./version-checker";

export const run = (name: string, version: string) => {
  console.info(
    blueBright(
      "Taskforce Connector v" + version + " - (c) 2017-2024 Taskforce.sh Inc."
    )
  );

  const program = new Command();
  program
    .version(version)

    .option(
      "-n, --name [name]",
      "connection name [My Connection]",
      "My Connection"
    )
    .option(
      "-t, --token [token]",
      "api token (get yours at https://taskforce.sh)",
      process.env.TASKFORCE_TOKEN
    )
    .option(
      "-p, --port [port]",
      "redis port [6379]",
      process.env.REDIS_PORT || "6379"
    )
    .option("--tls [tls]", "Activate secured TLS connection to Redis")
    .option(
      "-h, --host [host]",
      "redis host [localhost]",
      process.env.REDIS_HOST || "localhost"
    )
    .option("-d, --database [db]", "redis database [0]", "0")
    .option("--username [username]", "redis username", process.env.REDIS_USERNAME)
    .option("--passwd [passwd]", "redis password", process.env.REDIS_PASSWD)
    .option(
      "--spasswd [spasswd]",
      "redis sentinel password",
      process.env.REDIS_SENTINEL_PASSWD
    )
    .option("-u, --uri [uri]", "redis uri", process.env.REDIS_URI)
    .option("--team [team]", "specify team where to put the connection")
    .option(
      "-b, --backend [host]",
      "backend domain [api.taskforce.sh]",
      "wss://api.taskforce.sh"
    )
    .option(
      "-s, --sentinels [host:port]",
      "comma-separated list of sentinel host/port pairs",
      process.env.REDIS_SENTINELS
    )
    .option(
      "-m, --master [name]",
      "name of master node used in sentinel configuration",
      process.env.REDIS_MASTER
    )
    .option(
      "--nodes <nodes>",
      "comma-separated list of cluster nodes uris to connect to",
      process.env.REDIS_NODES ? process.env.REDIS_NODES : undefined
    )
    .option("--queues <queues>", "comma-separated list of queues to monitor")
    .addOption(
      new Option(
        "--queuesFile <queuesFile>",
        "file with queues to monitor"
      ).conflicts("queues")
    )
    .parse(process.argv);

  const options = program.opts();

  versionChecker(name, version).then(function () {
    /*
  lastestVersion(name).then(function (newestVersion) {
    if (semver.gt(newestVersion, version)) {
      console.error(
        chalk.yellow(
          "New version " +
            newestVersion +
            " of taskforce available, please upgrade with yarn global add taskforce-connector"
        )
      );
    }
      */
    if (!options.token) {
      console.error(
        red(
          `ERROR: A valid token is required, use either TASKFORCE_TOKEN env or pass it with -t (get token at https://taskforce.sh)`
        )
      );
      process.exit(1);
    }

    const queueNames = options.queuesFile
      ? parseQueuesFile(options.queuesFile)
      : options.queues
      ? parseQueues(options.queues)
      : undefined;

    const connection = {
      port: options.port,
      host: options.host,
      username: options.username,
      password: options.passwd,
      sentinelPassword: options.spasswd,
      db: options.database,
      uri: options.uri,
      tls: options.tls
        ? {
            rejectUnauthorized: false,
            requestCert: true,
            agent: false,
          }
        : void 0,
      sentinels:
        options.sentinels &&
        options.sentinels.split(",").map((hostPort: string) => {
          const [host, port] = hostPort.split(":");
          return { host, port };
        }),
      name: options.master,
    };

    Socket(options.name, options.backend, options.token, connection, {
      team: options.team,
      nodes: options.nodes ? options.nodes.split(",") : undefined,
      queueNames,
    });
  });

  // Catch uncaught exceptions and unhandled rejections
  process.on("uncaughtException", function (err) {
    console.error(err, "Uncaught exception");
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error({ promise, reason }, "Unhandled Rejection at: Promise");
  });

  function parseQueuesFile(file: string) {
    // Load the queues from the file. The file must be a list of queues separated by new lines
    const queuesFile = resolve(file);
    if (existsSync(queuesFile)) {
      return readFileSync(queuesFile, "utf8").split("\n").filter(Boolean);
    } else {
      console.error(red(`ERROR: File ${queuesFile} does not exist`));
      process.exit(1);
    }
  }

  function parseQueues(queuesString: string) {
    return queuesString.split(",");
  }
};
