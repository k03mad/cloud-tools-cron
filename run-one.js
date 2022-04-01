import {print} from '@k03mad/util';

import runner from './app/lib/runner.js';
import * as tasks from './app/tasks/_index.js';

const name = process.env.npm_config_name;
const task = tasks[name];

if (!task) {
    print.ex(`No task "${name}" found in index`, {exit: true});
}

(() => runner({task, name}))();
