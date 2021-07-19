'use strict';

const {repo} = require('@k03mad/utils');

/** @returns {Promise<string>} */
module.exports = () => repo.run('magnet-co-parser', 'start');
