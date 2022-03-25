import {pinger} from '@k03mad/util';

import env from '../../env.js';

const {cloud, mikrotik, nextdns} = env;

/** @returns {Promise} */
export default () => pinger.check([
    {domain: cloud.domain, port: cloud.magnet.port},
    {domain: cloud.domain, port: cloud.grafana.port},
    {domain: mikrotik.host, port: mikrotik.port.api},
    {domain: nextdns.domain},
]);
