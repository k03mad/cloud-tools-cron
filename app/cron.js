'use strict';

const {Cron} = require('recron');
const {print} = require('@k03mad/utils');

const tasks = {
    '@every 1m': {
        f2b: require('./tasks/f2b'),
        influx: require('./tasks/influx'),
        lastfm: require('./tasks/lastfm'),
        mikrotik: require('./tasks/mikrotik'),
        next: require('./tasks/next'),
        node: require('./tasks/node'),
        pinger: require('./tasks/pinger'),
        syncthing: require('./tasks/syncthing'),
        tinkoff: require('./tasks/tinkoff'),
    },

    '@every 1h': {
        apt: require('./tasks/apt'),
        myshows: require('./tasks/myshows'),
    },

    '@every 6h': {
        magnet: require('./tasks/magnet'),
    },
};

const cron = new Cron();
cron.start();

for (const [period, value] of Object.entries(tasks)) {
    for (const [name, func] of Object.entries(value)) {
        cron.schedule(period, async () => {
            try {
                await func();
            } catch (err) {
                print.ex(err, {
                    before: `${period} :: ${name}`,
                    afterline: false,
                });
            }
        }, {timezone: 'Europe/Moscow'});
    }
}
