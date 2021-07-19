'use strict';

const {Cron} = require('recron');
const {print} = require('@k03mad/utils');

const tasks = {
    '@every 10s': {
        pinger: require('./tasks/pinger'),
    },

    '* * * * *': {
        tinkoff: require('./tasks/tinkoff'),
    },

    '0 5 * * *': {
        magnet: require('./tasks/magnet'),
    },
};

const cron = new Cron();
cron.start();

for (const [key, value] of Object.entries(tasks)) {
    for (const [name, func] of Object.entries(value)) {
        cron.schedule(key, async () => {
            try {
                await func();
            } catch (err) {
                print.ex(err, {
                    before: `${key} :: ${name}`,
                    afterline: false,
                });
            }
        }, {timezone: 'Europe/Moscow'});
    }
}
