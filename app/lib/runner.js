import utils from '@k03mad/utils';

import env from '../../env.js';

const {influx, print, promise} = utils;
const tries = env.cloud.is ? 3 : 1;

/**
 * @param {object} opts
 * @param {Function} opts.task
 * @param {string} opts.name
 * @param {string} opts.period
 * @returns {Promise|null}
 */
export default async ({name, period = '—', task}) => {
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
                try {
                    await influx.write({meas: 'cloud-crons-errors', values: {[name]: 1}});
                } catch (err_) {
                    print.ex(err_);
                }

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
