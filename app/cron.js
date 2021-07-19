'use strict';

const {Cron} = require('recron');
const {default: PQueue} = require('p-queue');
const {print} = require('@k03mad/utils');

const queue = new PQueue({concurrency: 2});

const tasks = {
    '@every 10s': {
        pinger: require('./tasks/pinger'),
    },

    '@every 1s': {
        cloud: require('./tasks/cloud'),
        mikrotik: require('./tasks/mikrotik'),
        tinkoff: require('./tasks/tinkoff'),
    },

    '@every 5m': {
        next: require('./tasks/next'),
        request: require('./tasks/request'),
    },

    '@every 1h': {
        apt: require('./tasks/apt'),
    },

    '0 5 * * *': {
        magnet: require('./tasks/magnet'),
    },
};

const cron = new Cron();
cron.start();

for (const [period, value] of Object.entries(tasks)) {
    for (const [name, func] of Object.entries(value)) {
        cron.schedule(
            period,
            () => queue.add(async () => {
                try {
                    await func();
                } catch (err) {
                    print.ex(err, {
                        before: `${period} :: ${name}`,
                        afterline: false,
                    });
                }
            }),
            {timezone: 'Europe/Moscow'},
        );
    }
}
