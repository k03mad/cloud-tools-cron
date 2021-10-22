'use strict';

const converter = require('i18n-iso-countries');
const {influx, next, ip, cloud} = require('@k03mad/utils');

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
    .replace(/\s*(LLC|AO|OOO|JSC|ltd|Bank|Limited|Liability|Company|incorporated)\s*/g, '')
    .trim();

const topCountriesLen = 15;
const topCountriesNameMaxLen = 15;

const notifyLists = new Set([
    'AI-Driven Threat Detection',
    'DNS Rebinding',
    'Threat Intelligence Feeds',
]);

/***/
module.exports = async () => {
    const [lists, {logs}] = await Promise.all([
        next.query({path: 'privacy'}),
        next.query({path: 'logs'}),
    ]);

    const [
        topCountries,
        gafam,
        dnssec,
        secure,
        topRoot,
        topDevices,
        topLists,
        topDomainsBlocked,
        topDomainsResolved,
        counters,
        queriesPerDay,
        ips,
    ] = await Promise.all([
        'traffic_destination_countries',
        'gafam',
        'dnssec',
        'secure_dns',
        'top_root_domains',
        'top_devices',
        'top_lists',
        'top_domains/blocked',
        'top_domains/resolved',
        'counters',
        'queries_chart',
        'top_client_ips',
    ].map(req => next.query({
        path: `analytics/${req}`,
        searchParams: {from: '-30d', timezoneOffset: '-180', selector: true},
    })));

    topDomainsBlocked.forEach(elem => {
        elem.queries = -elem.queries;
    });

    topLists.forEach(list => {
        list.id = lists.blocklists.find(elem => elem.name === list.name)?.id;
    });

    const listsStatus = {};

    const notify = [];

    logs.forEach(elem => {
        elem.lists.forEach(list => {
            if (notifyLists.has(list)) {
                notify.push([list, elem.deviceName, elem.name]. join(' '));
            }

            if (listsStatus[list]) {
                listsStatus[list] += 1;
            } else {
                listsStatus[list] = 1;
            }
        });
    });

    const topCountriesToValues = Object.fromEntries(
        Object
            .entries(topCountries)
            .map(elem => {
                let name = converter.getName(elem[0], 'en');

                if (name.length > topCountriesNameMaxLen) {
                    name = converter.alpha2ToAlpha3(elem[0]);
                }

                return [name, elem[1].queries];
            })
            .sort((a, b) => b[1] - a[1])
            .slice(0, topCountriesLen),
    );

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
        {meas: 'next-counters', values: counters},
        {meas: 'next-dnssec', values: dnssec},
        {meas: 'next-gafam', values: mapValues(gafam, {key: 'company'})},
        {meas: 'next-lists', values: mapValues(lists.blocklists, {key: 'id', value: 'entries'})},
        {meas: 'next-logs-lists', values: listsStatus},
        {meas: 'next-secure', values: secure},
        {meas: 'next-top-countries', values: topCountriesToValues},
        {meas: 'next-top-devices', values: mapValues(topDevices)},
        {meas: 'next-top-domains-blocked', values: mapValues(topDomainsBlocked)},
        {meas: 'next-top-domains-resolved', values: mapValues(topDomainsResolved)},
        {meas: 'next-top-ips', values: mapValues(ips, {key: 'ip'})},
        {meas: 'next-top-lists', values: mapValues(topLists, {key: 'id'})},
        {meas: 'next-top-root', values: mapValues(topRoot)},

        queriesPerDay.map(elem => ({
            meas: 'next-queries',
            values: {queries: elem.queries, blocked: elem.blockedQueries},
            timestamp: `${elem.name}000000000`,
        })),

        devicesRequestsIsp,
    ].flat(Number.POSITIVE_INFINITY));
};
