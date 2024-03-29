import {Cron} from 'recron';

import runner from './lib/runner.js';
import generateCron from './lib/tasks.js';

const cron = new Cron();
cron.start();

const hourTasks = [
    'apt',
    'git',
];

const minuteTasks = [
    'adg',
    'cloud',
    'f2b',
    'influx',
    'mikrotik',
    'node',
    'pinger',
    'ufw',
];

const tasks = {
    ...generateCron(minuteTasks, {everyMinute: true}),
    ...generateCron(hourTasks, {everyHour: true}),
};

for (const [period, value] of Object.entries(tasks)) {
    for (const [name, task] of Object.entries(value)) {
        cron.schedule(
            period,
            () => runner({task, name, period}),
            {timezone: 'Europe/Moscow'},
        );
    }
}
