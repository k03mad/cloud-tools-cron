import {Cron} from 'recron';

import runner from './lib/runner.js';
import generateCron from './lib/tasks.js';

const cron = new Cron();
cron.start();

const everyHourTasks = [
    'apt',
    'git',
    'myshows',
    'magnet-shows',
    'magnet-films',
];

const everyMinuteTasks = [
    'cloud',
    'f2b',
    'influx',
    'lastfm',
    'mikrotik',
    'next',
    'node',
    'pinger',
    'syncthing',
    // 'tinkoff',
    'tinkoff-atm',
    'ufw',
];

const tasks = {
    ...generateCron(everyMinuteTasks),
    ...generateCron(everyHourTasks, 'hour'),
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
