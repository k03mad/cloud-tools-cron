import runner from './app/lib/runner.js';
import * as tasks from './app/tasks/_index.js';

const name = process.env.npm_config_name;
const task = tasks[name];

(() => runner({task, name}))();
