const WebSocket = require('ws');
const chalk = require('chalk');

function WebSocketClient(){
  this.number = 0;	// Message number
  this.autoReconnectInterval = 5*1000;	// ms
}

WebSocketClient.prototype.open = function(url, opts){
  this.url = url;
  this.opts = opts;

  this.instance = new WebSocket(url, opts);
  this.instance.on('open',()=>{
    this.onopen();
  });
  this.instance.on('message', (data, flags)=>{
    this.number++;
    this.onmessage(data, flags, this.number);
  });
  this.instance.on('close', (err)=>{
    switch (err){
    case 1000:	// CLOSE_NORMAL
      console.log(chalk.yellow("WebSocket:") + chalk.blue(" closed"));
      break;
    case 4000:
      console.log(chalk.yellow("WebSocket:") + chalk.red(" Invalid authentication"));
      break;
    default:	// Abnormal closure
      this.reconnect(err);
      break;
    }
    this.onclose(err);
  });
  this.instance.on('error', (err)=>{
    switch (err.code){
    case 'ECONNREFUSED':
      this.reconnect(err);
      break;
    default:
      this.onerror(err);
      break;
    }
  });
}

WebSocketClient.prototype.send = function(data, option){
  try{
    this.instance.send(data, option);
  }catch (err){
    this.instance.emit('error', err);
  }
}

WebSocketClient.prototype.reconnect = function(err, opts){
  var msg = err.message || '';
  console.log(chalk.yellow("WebSocket:") + chalk.red(` ${msg} retry in ${this.autoReconnectInterval}ms`));
  this.instance.removeAllListeners();
  var _this = this;
  setTimeout(function(){
    console.log("WebSocket: reconnecting...");
    _this.open(_this.url, _this.opts);
  }, this.autoReconnectInterval);
}

WebSocketClient.prototype.onopen = function(e){
  console.log("WebSocket: open", arguments);
}

WebSocketClient.prototype.onmessage = function(data, flags, number){
  console.log("WebSocket: message", arguments);
}
WebSocketClient.prototype.onerror = function(e){
  console.log("WebSocket: error", arguments);
}
WebSocketClient.prototype.onclose = function(e){
  console.log("WebSocket: closed", arguments);
}

module.exports = WebSocketClient;
