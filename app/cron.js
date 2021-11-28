'use strict';

const generateCron = require('./lib/tasks');
const runner = require('./lib/runner');
const {Cron} = require('recron');

const cron = new Cron();
cron.start();

const everyHourTasks = {
    'apt': require('./tasks/apt'),
    'git': require('./tasks/git'),
    'myshows': require('./tasks/myshows'),
    'magnet-shows': require('./tasks/magnet-shows'),
    'magnet-films': require('./tasks/magnet-films'),
};

const everyMinuteTasks = {
    cloud: require('./tasks/cloud'),
    f2b: require('./tasks/f2b'),
    influx: require('./tasks/influx'),
    lastfm: require('./tasks/lastfm'),
    mikrotik: require('./tasks/mikrotik'),
    next: require('./tasks/next'),
    node: require('./tasks/node'),
    pinger: require('./tasks/pinger'),
    syncthing: require('./tasks/syncthing'),
    tinkoff: require('./tasks/tinkoff'),
    ufw: require('./tasks/ufw'),
};

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
