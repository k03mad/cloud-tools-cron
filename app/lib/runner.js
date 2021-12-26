import {influx, print, promise} from '@k03mad/util';

import env from '../../env.js';

const tries = env.cloud.is ? 3 : 1;

/**
 * @param {object} opts
 * @param {Function} opts.task
 * @param {string} opts.name
 * @param {string} opts.period
 * @returns {Promise|null}
 */
export default async ({name, period = '—', task}) => {
    let errCount = 0;

    for (let i = 1; i <= tries; i++) {
        try {
            const time = Date.now();
            await task();

            if (env.influx.request) {
                const duration = Date.now() - time;
                return await influx.write({meas: 'cloud-crons-time', values: {[name]: duration}});
            }

            return;
        } catch (err) {
            if (i === tries) {
                print.ex(err, {
                    before: `${name} :: ${period} :: ${i}/${tries}`,
                    afterline: false,
                    full: true,
                });

                errCount = 1;
                break;
            }

            errCount++;
            await promise.delay(5000);
        }
    }

    if (env.influx.request) {
        try {
            await influx.write({meas: 'cloud-crons-errors', values: {[name]: errCount}});
        } catch (err_) {
            print.ex(err_);
        }
    }
};
