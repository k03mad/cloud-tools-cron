import {Cron} from 'recron';

import runner from './lib/runner.js';
import generateCron from './lib/tasks.js';

const cron = new Cron();
cron.start();

const hourTasks = [
    'apt',
    'git',
    'myshows',
];

const minuteTasks = [
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
    'ufw',
];

const tasks = {
    ...generateCron('magnet-shows', {cronString: '30 3 * * *'}),
    ...generateCron('magnet-films', {cronString: '30 4 * * *'}),
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
