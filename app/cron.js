import {Cron} from 'recron';

import runner from './lib/runner.js';
import generateCron from './lib/tasks.js';

const cron = new Cron();
cron.start();

const everyHourTasks = [
    'apt',
    'git',
    'myshows',
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
    ...generateCron('magnet-shows', {cronString: '30 3 * * *'}),
    ...generateCron('magnet-films', {cronString: '30 4 * * *'}),
    ...generateCron(everyMinuteTasks, {everyMinute: true}),
    ...generateCron(everyHourTasks, {everyHour: true}),
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
