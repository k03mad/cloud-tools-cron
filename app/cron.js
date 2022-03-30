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
    // 'tinkoff',
    'ufw',
];

const tasks = {
    ...generateCron('magnet-shows', {cronString: '0 */6 * * *'}),
    ...generateCron('magnet-films', {cronString: '30 */6 * * *'}),
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
