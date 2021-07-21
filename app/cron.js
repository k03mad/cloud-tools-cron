'use strict';

const {Cron} = require('recron');
const {default: PQueue} = require('p-queue');
const {print} = require('@k03mad/utils');

const queue = new PQueue({concurrency: 2});

const tasks = {
    '@every 10s': {
        pinger: require('./tasks/pinger'),
    },

    '@every 1m': {
        f2b: require('./tasks/f2b'),
        mikrotik: require('./tasks/mikrotik'),
        next: require('./tasks/next'),
        node: require('./tasks/node'),
        tinkoff: require('./tasks/tinkoff'),
    },

    '@every 1h': {
        apt: require('./tasks/apt'),
    },

    '@every 6h': {
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
