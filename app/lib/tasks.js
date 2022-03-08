import * as tasks from '../tasks/_index.js';

/**
 * @param {Array} names
 * @param {object} opts
 * @param {boolean} opts.everyMinute
 * @param {boolean} opts.everyHour
 * @param {string} opts.cronString
 * @returns {object}
 */
export default (names, {cronString, everyHour, everyMinute} = {}) => {
    const output = {};

    const valuesForTask = Math.floor(60 / names.length);

    names.forEach((name, i) => {
        let cron;

        if (cronString) {
            cron = cronString;
        } else {
            cron = `${i * valuesForTask} */1 `;

            if (everyMinute) {
                cron += '* * * *';
            } else if (everyHour) {
                cron += '* * *';
            }
        }

        output[cron] = {[name]: tasks[name.replace('-', '_')]};
    });

    return output;
};
