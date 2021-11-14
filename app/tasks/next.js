'use strict';

const {influx, next, ip, cloud, object} = require('@k03mad/utils');

const mapValues = (
    data, {key = 'name', value = 'queries'} = {},
) => Object.fromEntries(
    data
        .filter(elem => elem[key])
        .map(elem => [elem[key], elem[value]]),
);

const renameIsp = isp => isp
    .replace('Net By Net Holding LLC', 'NBN')
    .replace('T2 Mobile', 'Tele2')
    .replace(/\s*(LLC|AO|OOO|JSC|ltd|Ltd.|Bank|Limited|Liability|Company|incorporated)\s*/g, '')
    .trim();

const notifyLists = new Set([
    'AI-Driven Threat Detection',
    'Threat Intelligence Feeds',
]);

let logsElementLastTimestamp = 0;

/***/
module.exports = async () => {
    await next.auth();

    const [
        topRoot,
        topDevices,
        topDomainsBlocked,
        topDomainsResolved,
        lists,
        {logs},
    ] = await Promise.all([
        ...[
            'top_root_domains',
            'top_devices',
            'top_domains/blocked',
            'top_domains/resolved',
        ].map(req => next.query({
            path: `analytics/${req}`,
            searchParams: {from: '-30d', timezoneOffset: '-180', selector: true},
        })),

        next.query({path: 'privacy'}),
        next.query({path: 'logs'}),
    ]);

    const logsLists = {};
    const logsProtocol = {};
    const logsStatus = {};
    const logsDnssec = {};
    const logsType = {};
    const logsEncrypted = {};
    const logsDomain = {};
    const logsDevice = {};
    const logsIsp = {};
    const logsCity = {};

    const notify = [];

    await Promise.all(logs.map(async elem => {
        if (elem.timestamp > logsElementLastTimestamp) {
            object.count(logsEncrypted, elem.isEncryptedDNS);
            object.count(logsStatus, elem.status);
            object.count(logsDnssec, elem.dnssec);
            object.count(logsType, elem.type);
            object.count(logsProtocol, elem.protocol);

            elem.name.includes('.')
                && object.count(logsDomain, elem.name.split('.').pop());

            elem.deviceName
                && object.count(logsDevice, elem.deviceName);

            const geo = await ip.lookup(elem.clientIp);

            geo.isp
                && object.count(logsIsp, renameIsp(geo.isp));

            geo.city
                ? object.count(logsCity, geo.city)
                : object.count(logsCity, geo.countryname);

            for (const list of elem.lists) {
                notifyLists.has(list)
                    && notify.push(`${list} :: ${elem.deviceName}\n— ${elem.name}`);

                object.count(logsLists, list);
            }
        }
    }));

    logsElementLastTimestamp = logs[0].timestamp;

    const devicesRequestsIsp = await Promise.all(topDevices.map(async ({id, name}, i) => {
        const {logs: deviceLogs} = await next.query({
            path: 'logs',
            searchParams: {device: id, simple: 1, lng: 'en'},
        });

        return Promise.all(deviceLogs.map(async log => {
            const geo = await ip.lookup(log.clientIp);
            const key = `${name} :: ${renameIsp(geo.isp)}`;

            return {
                meas: 'next-req-devices-isp',
                values: {[key]: i + 1},
                timestamp: `${log.timestamp}000000`,
            };
        }));
    }));

    if (notify.length > 0) {
        await cloud.notify({text: notify.join('\n'), parse_mode: ''});
    }

    await influx.write([
        {meas: 'next-count-lists', values: mapValues(lists.blocklists, {key: 'id', value: 'entries'})},

        {meas: 'next-top-devices', values: mapValues(topDevices)},
        {meas: 'next-top-domains-blocked', values: mapValues(topDomainsBlocked)},
        {meas: 'next-top-domains-resolved', values: mapValues(topDomainsResolved)},
        {meas: 'next-top-root', values: mapValues(topRoot)},

        {meas: 'next-logs-lists', values: logsLists},
        {meas: 'next-logs-protocol', values: logsProtocol},
        {meas: 'next-logs-status', values: logsStatus},
        {meas: 'next-logs-dnssec', values: logsDnssec},
        {meas: 'next-logs-type', values: logsType},
        {meas: 'next-logs-encrypted', values: logsEncrypted},
        {meas: 'next-logs-domain', values: logsDomain},
        {meas: 'next-logs-device', values: logsDevice},
        {meas: 'next-logs-isp', values: logsIsp},
        {meas: 'next-logs-city', values: logsCity},

        devicesRequestsIsp,
    ].flat(Number.POSITIVE_INFINITY));
};
