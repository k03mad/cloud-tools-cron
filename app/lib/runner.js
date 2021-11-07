'use strict';

const {print, influx, promise} = require('@k03mad/utils');

const tries = 3;

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

            const duration = Date.now() - time;
            return await influx.write({meas: 'cloud-crons-time', values: {[name]: duration}});
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
