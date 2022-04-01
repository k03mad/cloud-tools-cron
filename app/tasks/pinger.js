import {pinger} from '@k03mad/util';

import env from '../../env.js';

const {adg, cloud, mikrotik, nextdns} = env;

/** @returns {Promise} */
export default () => pinger.check([
    {domain: cloud.domain, port: cloud.grafana.port},
    {domain: cloud.domain, port: cloud.magnet.port},
    {domain: mikrotik.host, port: mikrotik.port.api},
    {domain: nextdns.domain, port: 853},
    {domain: adg.domain, port: 853},
    {domain: 'dns.adguard.com', port: 53},
]);
