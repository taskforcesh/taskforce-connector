#! /usr/bin/env node
const program = require("commander");
const { name, version } = require(__dirname + "/package.json");
const chalk = require("chalk");

// Check version
const lastestVersion = require("latest-version");
const semver = require("semver");

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
  .parse(process.argv);

console.info(
  chalk.blueBright(
    "Taskforce Connector v" + version + " - (c) 2017-2024 Taskforce.sh Inc."
  )
);

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
  if (!program.token) {
    console.error(
      chalk.red(
        `ERROR: A valid token is required, use either TASKFORCE_TOKEN env or pass it with -t (get token at https://taskforce.sh)`
      )
    );
    process.exit(1);
  }

  const connection = {
    port: program.port,
    host: program.host,
    password: program.passwd,
    sentinelPassword: program.spasswd,
    db: program.database,
    uri: program.uri,
    tls: program.tls
      ? {
          rejectUnauthorized: false,
          requestCert: true,
          agent: false,
        }
      : void 0,
    sentinels:
      program.sentinels &&
      program.sentinels.split(",").map((hostPort) => {
        const [host, port] = hostPort.split(":");
        return { host, port };
      }),
    name: program.master,
  };

  const { Socket } = require("./dist/socket");
  Socket(program.name, program.backend, program.token, connection, {
    team: program.team,
    nodes: program.nodes ? program.nodes.split(",") : undefined,
  });
});

// Catch uncaught exceptions and unhandled rejections
process.on("uncaughtException", function (err) {
  console.error(err, "Uncaught exception");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error({ promise, reason }, "Unhandled Rejection at: Promise");
});
