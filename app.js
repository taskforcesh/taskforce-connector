#! /usr/bin/env node
const { name, version } = require(__dirname + "/package.json");

const { run } = require("./dist/cmd.js");
run(name, version);
