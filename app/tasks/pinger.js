import {pinger} from '@k03mad/util';

import env from '../../env.js';

const {adg, cloud, mikrotik} = env;

/** @returns {Promise} */
export default () => pinger.check([
    {domain: cloud.domain, port: cloud.grafana.port},
    {domain: mikrotik.host, port: mikrotik.port.api},
    {domain: adg.domain, port: 853},
    {domain: 'dns.adguard.com', port: 53},
]);
