'use strict';

const {mikrotik} = require('../../env');
const {pinger} = require('@k03mad/utils');

/** @returns {Promise} */
module.exports = () => pinger.check({domain: mikrotik.domain, port: 9595});
