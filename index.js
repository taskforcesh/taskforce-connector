#! /usr/bin/env node
const program = require("commander");
const pkg = require(__dirname + "/package.json");
const chalk = require("chalk");

// Check version
const npmview = require("npmview");
const semver = require("semver");

// get local package name and version from package.json
const pkgName = require("./package.json").name;
const pkgVersion = require("./package.json").version;

program
  .version(pkg.version)

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
  .option(
    "-h, --host [host]",
    "redis host [localhost]",
    process.env.REDIS_HOST || "localhost"
  )
  .option("-d, --database [db]", "redis database [0]", "0")
  .option("--passwd [passwd]", "redis password", process.env.REDIS_PASSWD)
  .option(
    "-b, --backend [host]",
    "backend domain [api.taskforce.sh]",
    "wss://api.taskforce.sh"
  )
  .parse(process.argv);

console.info(
  chalk.blue(
    "Taskforce Connector v" + pkg.version + " - (c) 2017-2018 Taskforce.sh Inc."
  )
);

npmview(pkgName, function(err, version, moduleInfo) {
  if (semver.gt(version, pkgVersion)) {
    console.error(
      chalk.red(
        "New version " +
          version +
          " of taskforce available, please upgrade with yarn global add taskforce-connector"
      )
    );
  } else {
    if (!program.token) {
      console.error(
        chalk.red(
          `ERROR: A valid token is required, use either TASKFORCE_TOKEN env or pass it with -t (get token at https://taskforce.sh)`
        )
      );
      process.exit();
    }

    const connection = {
      port: program.port,
      host: program.host,
      password: program.passwd,
      db: program.database
    };

    const socket = require("./dist/socket");
    socket(program.name, program.backend, program.token, connection);
  }
});
