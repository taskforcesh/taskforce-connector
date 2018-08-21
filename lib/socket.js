const WebSocket = require('./ws-autoreconnect');
const Redis = require('ioredis');
const _ = require('lodash');
const Promise = require('bluebird');
const chalk = require('chalk');
const bull = require('bull');

module.exports = (name, server, token, uriOrConnectionObj, debug) => {
  if (!debug) console.log = function(){}
  const connection = typeof uriOrConnectionObj === 'string'
    ? uriOrConnectionObj
    : _.pick(uriOrConnectionObj, ['port', 'host', 'family', 'password', 'db'])
  var redisClient = new Redis(connection);

  const ws = new WebSocket();

  ws.open(server, {
    headers: {
      Authorization: 'Bearer ' + token,
      Taskforce: 'connector'
    }
  });

  const queues = {};

  ws.onopen = function open() {
    console.log(chalk.yellow('WebSocket:') + chalk.blue(' opened connection to ') + chalk.gray('Taskforce.sh'));
  };

  ws.onerror = function (err) {
    var msg;
    if(err.message === 'unexpected server response (401)'){
      msg = 'Authorization failed, please check that you are using the correct token from your account page';
    }else{
      msg = err.message;
    }
    console.log(chalk.yellow('WebSocket: ') + chalk.red(msg)); 
  };

  ws.onmessage = function incoming(msg) {
    console.log(chalk.yellow('WebSocket:') + chalk.blue(' received'), msg);
    if (msg === 'authorized') {
      console.log(chalk.yellow('WebSocket: ') + chalk.green('Succesfully authorized to taskforce.sh service'));
      //
      // Send this connection.
      //
      getConnectionQueues(connection).then(function (queues) {
        console.log(chalk.yellow('WebSocket: ') + chalk.green('sending connection: ') + chalk.blue(name));
        ws.send(JSON.stringify({
          res: 'connection',
          cmd: 'update',
          queues: queues,
          connection: name,
        }));
      });
      return;
    }

    msg = JSON.parse(msg);

    if (!msg.data) {
      console.error(chalk.red('WebSocket:') + chalk.blue(' missing message data '), msg);
      return;
    }

    var data = msg.data;

    console.log(data);

    switch (data.res) {
      case 'connections':
        switch (data.cmd) {
          case 'getConnection':
            getConnectionQueues(connection).then(function (queues) {
              console.log(chalk.yellow('WebSocket: ') + chalk.green('sending connection: ') + chalk.blue(name));
              ws.send(JSON.stringify({
                id: msg.id,
                data: {
                  queues: queues,
                  connection: name
                }
              }));
            });
            break;
          case 'getQueues':
            getConnectionQueues(connection).then(function (queues) {
              return updateQueueCache(queues).then(function () {
                console.log(chalk.yellow('WebSocket:') + chalk.blue(' sending queues '), queues);

                ws.send(JSON.stringify({
                  id: msg.id,
                  data: queues
                }));
              });
            });
            break;
        }
        break;
      case 'queues':
        var queue = queues[data.queueName];
        if (queue) {
          switch (data.cmd) {
            case 'getJobCounts':
              queue.getJobCounts().then(function (jobCounts) {
                ws.send(JSON.stringify({
                  id: msg.id,
                  data: jobCounts
                }));
              });
              break;
            case 'getWaiting':
            case 'getActive':
            case 'getDelayed':
            case 'getCompleted':
            case 'getFailed':
            case 'getRepeatableJobs':
            case 'getWorkers':
              console.log('Get cmd received', data.cmd);
              paginate(queue, msg.id, data.start, data.end, data.cmd, ws);
              break;

            case 'getWaitingCount':
            case 'getActiveCount':
            case 'getDelayedCount':
            case 'getCompletedCount':
            case 'getFailedCount':
            case 'getRepeatableCount':
            case 'getWorkersCount':
              queue[data.cmd]().then(function (count) {
                ws.send(JSON.stringify({
                  id: msg.id,
                  data: count
                }));
              });
              break;
          }
        } else {
          ws.send(JSON.stringify({
            id: msg.id,
            err: 'Queue not found'
          }));
        }
    }
  };

  var queueNameRegExp = new RegExp('(.*)\:(.*)\:id');
  function getConnectionQueues(connection) {
    var queues = [];
    return redisClient.keys('*:*:id').then(function (keys) {
      queues = keys.map(function (key) {
        var match = queueNameRegExp.exec(key);
        if (match) {
          return {
            prefix: match[1],
            name: match[2]
          }
        }
      });
      return queues;
    });
  }

  function updateQueueCache(newQueues) {
    const oldQueues = Object.keys(queues);
    const toRemove = _.difference(oldQueues, newQueues);
    const toAdd = _.difference(newQueues, oldQueues);

    return Promise.all(toRemove.map(function (queueName) {
      var closing = queues[queueName].close();
      delete queues[queueName];
      return closing;
    })).then(function () {
      console.log('TO ADD', toAdd)
      toAdd.forEach(function (queue) {
        queues[queue.name] = new bull(queue.name, { redis: connection, prefix: queue.prefix });
      });
    });
  }

  function paginate(queue, messageId, start, end, method, ws) {
    start = start || 0;
    end = end || -1;
    return queue[method](start, end).then(function (jobs) {
      ws.send(JSON.stringify({
        id: messageId,
        data: jobs
      }));
    });
  }
}
