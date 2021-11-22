'use strict';

const env = require('../../env');
const {print, influx, promise} = require('@k03mad/utils');

const tries = env.cloud.is ? 3 : 1;

/**
 * @param {object} opts
 * @param {Function} opts.task
 * @param {string} opts.name
 * @param {string} opts.period
 * @returns {Promise|null}
 */
module.exports = async ({task, name, period = '—'}) => {
    for (let i = 1; i <= tries; i++) {
        try {
            const time = Date.now();
            await task();

            if (env.influx.request) {
                const duration = Date.now() - time;
                return await influx.write({meas: 'cloud-crons-time', values: {[name]: duration}});
            }

            return null;
        } catch (err) {
            if (i === tries) {
                return print.ex(err, {
                    before: `${name} :: ${period} :: ${i}/${tries}`,
                    afterline: false,
                });
            }

            await promise.delay(5000);
        }
    }

    return null;
};
