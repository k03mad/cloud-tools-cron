'use strict';

const {mikrotik, nextdns, cloud} = require('../../env');
const {pinger} = require('@k03mad/utils');

/** @returns {Promise} */
module.exports = () => pinger.check([
    {domain: cloud.domain, port: cloud.magnet.port},
    {domain: cloud.domain, port: cloud.grafana.port},
    {domain: mikrotik.domain, port: mikrotik.ovpn.port},
    {domain: nextdns.domain},
]);
