'use strict';

const name = process.env.npm_config_name;

const runner = require('./app/lib/runner');
const task = require(`./app/tasks/${name}`);

(() => runner({task, name}))();
