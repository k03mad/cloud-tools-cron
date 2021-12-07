import utils from '@k03mad/util';

import env from '../../env.js';

const {pinger} = utils;
const {cloud, mikrotik, nextdns} = env;

/** @returns {Promise} */
export default () => pinger.check([
    {domain: cloud.domain, port: cloud.magnet.port},
    {domain: cloud.domain, port: cloud.grafana.port},
    {domain: mikrotik.domain, port: mikrotik.ovpn.port},
    {domain: nextdns.domain},
]);
