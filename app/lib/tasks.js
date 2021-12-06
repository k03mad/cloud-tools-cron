import * as tasks from '../tasks/_index.js';

/**
 * @param {Array} names
 * @param {string} type
 * @returns {object}
 */
export default (names, type = 'minute') => {
    const output = {};

    const valuesForTask = Math.floor(60 / names.length);

    names.forEach((name, i) => {
        const cron = `${i * valuesForTask} */1 ${type === 'minute' ? '* * * *' : '* * *'}`;
        output[cron] = {[name]: tasks[name.replace('-', '_')]};
    });

    return output;
};
