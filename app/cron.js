'use strict';

const runner = require('./lib/runner');
const {Cron} = require('recron');

const cron = new Cron();
cron.start();

const tasks = {
    '@every 1h': {
        apt: require('./tasks/apt'),
        myshows: require('./tasks/myshows'),
    },

    '@every 6h': {
        magnet: require('./tasks/magnet'),
    },
};

const everyMinuteTasks = {
    f2b: require('./tasks/f2b'),
    influx: require('./tasks/influx'),
    lastfm: require('./tasks/lastfm'),
    mikrotik: require('./tasks/mikrotik'),
    next: require('./tasks/next'),
    node: require('./tasks/node'),
    pinger: require('./tasks/pinger'),
    syncthing: require('./tasks/syncthing'),
    tinkoff: require('./tasks/tinkoff'),
};

const everyMinuteTasksArr = Object.entries(everyMinuteTasks);
const secondsForTask = Math.floor(59 / everyMinuteTasksArr.length);

everyMinuteTasksArr.forEach(([key, value], i) => {
    tasks[`${i * secondsForTask} */1 * * * *`] = {[key]: value};
});

for (const [period, value] of Object.entries(tasks)) {
    for (const [name, task] of Object.entries(value)) {
        cron.schedule(
            period,
            () => runner({task, name, period}),
            {timezone: 'Europe/Moscow'},
        );
    }
}
