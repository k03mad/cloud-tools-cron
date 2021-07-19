'use strict';

const converter = require('i18n-iso-countries');
const pMap = require('p-map');
const {influx, next, ip} = require('@k03mad/utils');

const mapValues = (
    data, {key = 'name', value = 'queries'} = {},
) => Object.fromEntries(
    data
        .filter(elem => elem[key])
        .map(elem => [elem[key], elem[value]]),
);

/***/
module.exports = async () => {
    const concurrency = 3;

    const topCountriesLen = 15;
    const topCountriesNameMaxLen = 15;

    const lists = await next.query({path: 'privacy'});

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
    ] = await pMap([
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
    ], req => next.query({
        path: `analytics/${req}`,
        searchParams: {from: '-30d', timezoneOffset: '-180', selector: true},
    }), {concurrency});

    topDomainsBlocked.forEach(elem => {
        elem.queries = -elem.queries;
    });

    topLists.forEach(list => {
        list.id = lists.blocklists.find(elem => elem.name === list.name)?.id;
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

    const devicesRequestsIsp = await pMap(topDevices, async ({id, name}, i) => {
        const {logs} = await next.query({
            path: 'logs',
            searchParams: {device: id, simple: 1, lng: 'en'},
        });

        return pMap(logs, async log => {
            const geo = await ip.lookup(log.clientIp);
            const key = `${name} :: ${
                geo.isp
                    .replace('Net By Net Holding LLC', 'NBN')
                    .replace('T2 Mobile', 'Tele2')
                    .replace(/\s*(LLC|AO|OOO|JSC|ltd|Bank|Limited|Liability|Company)\s*/g, '')
                    .trim()
            }`;

            return {
                meas: 'next-req-devices-isp',
                values: {[key]: i + 1},
                timestamp: `${log.timestamp}000000`,
            };
        }, {concurrency});
    }, {concurrency});

    await influx.write([
        {meas: 'next-counters', values: counters},
        {meas: 'next-dnssec', values: dnssec},
        {meas: 'next-gafam', values: mapValues(gafam, {key: 'company'})},
        {meas: 'next-lists', values: mapValues(lists.blocklists, {key: 'id', value: 'entries'})},
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
