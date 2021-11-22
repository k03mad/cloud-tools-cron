'use strict';

/**
 * @param {object} tasks
 * @param {string} type
 * @returns {object}
 */
module.exports = (tasks, type = 'minute') => {
    const output = {};

    const tasksArr = Object.entries(tasks);
    const valuesForTask = Math.floor(60 / tasksArr.length);

    tasksArr.forEach(([key, value], i) => {
        const cron = `${i * valuesForTask} */1 ${type === 'minute' ? '* * * *' : '* * *'}`;
        output[cron] = {[key]: value};
    });

    return output;
};
