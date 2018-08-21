#! /usr/bin/env node
const program = require('commander');
const pkg = require('./package.json');
const chalk = require('chalk');

program
  .version(pkg.version)
  .option('-n, --name [name]', 'connection name [My Connection]', 'My Connection')
  .option('-t, --token [token]', 'api token (get yours at https://taskforce.sh)')
  .option('-p, --port [port]', 'redis port [6379]', '6379')
  .option('-h, --host [host]', 'redis host [localhost]', 'localhost')
  .option('--passwd [passwd]', 'redis password')
  .option('-b, --backend [host]', 'backend domain [api.taskforce.sh]', 'wss://api.taskforce.sh')  
  .option('-d, --database [db]', 'redis database [0]', '0')  
  .option('-u, --uri [uri]', 'redis uri string')
  .option('-D, --debug [debug]', 'print debugging information', false)
  .parse(process.argv);

console.info(chalk.blue('Taskforce Connector v' + pkg.version + ' - (c) 2017 Taskforce.sh Inc.'))

const connection = program.uri || {
  port: program.port,
  host: program.host,
  password: program.passwd,
  db: program.passwd
};

const socket = require('./lib/socket');

socket(program.name, program.backend, program.token, connection, program.debug);
