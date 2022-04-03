/* eslint-disable camelcase */
import {adg, influx, object} from '@k03mad/util';
import emoji from 'country-code-emoji';
import countries from 'i18n-iso-countries';
import fs from 'node:fs/promises';
import path from 'node:path';

import env from '../../env.js';
import {renameIsp} from '../lib/utils.js';

const getCacheFileAbsPath = (file = 'foo') => {
    const {pathname} = new URL(`../../.adg/${file}`, import.meta.url);
    return {pathname, dirname: path.dirname(pathname)};
};

let logsElementLastTimestamp = 0;

/** */
export default async () => {
    const timeTo = Date.now();
    // 24h
    const timeFrom = timeTo - 86_400_000;
    const timeParams = `time_from_millis=${timeFrom}&time_to_millis=${timeTo}`;

    const [
        account,
        devices,
        dnsServers,
        filters,

        statsCompanies,
        statsCountries,
        statsDashboard,
        statsGeneral,

        logs,
    ] = await Promise.all([
        'account',
        'devices',
        'dns_servers',
        'filters',

        `stats/companies_filter?${timeParams}`,
        `stats/countries_filter?${timeParams}`,
        `stats/dashboard?${timeParams}`,
        `stats/general?${timeParams}`,

        `query_log?${timeParams}&limit=100`,
    ].map(elem => adg.get(elem)));

    /**
     * Data used in other values
     */
    const deviceIdToName = Object.fromEntries(devices
        .map(({id, name}) => [id, name]));

    const enabledFilters = Object.fromEntries(dnsServers[0].settings.filter_lists_settings.filter_list
        .map(({enabled, filter_id}) => [filter_id, enabled]));

    /**
     * Data from common handlers
     */
    const limitsValues = {...account.license.account_limits, ...account.license.request_limits};

    const filtersValues = Object.fromEntries(filters
        .filter(({filter_id}) => enabledFilters[filter_id])
        .map(({filter_id, rules_count}) => [filter_id, rules_count]));

    const categoriesValues = Object.fromEntries(statsGeneral.category_types_stats.stats
        .filter(({category_type}) => category_type !== 'OTHERS')
        .map(({category_type, queries}) => [category_type, queries]));

    const domainsValues = Object.fromEntries(statsGeneral.domains_stats.stats
        .map(({domain, value}) => [domain, value.queries]));

    /**
     * Data from stats handler
     */
    const statsClientsValues = Object.fromEntries(statsDashboard.dns_servers_stats.values[0].devices_stats
        .map(({device_id, stats}) => [deviceIdToName[device_id], stats.queries]));

    const statsCompaniesValues = Object.fromEntries(statsCompanies
        .filter(({queries}) => queries)
        .map(({company, queries}) => [company.company_name, queries]));

    const statsCountriesValues = Object.fromEntries(statsCountries
        .filter(({country_code, queries}) => queries && country_code !== 'UNKNOWN_COUNTRY')
        .map(({country_code, queries}) => [`${countries.alpha2ToAlpha3(country_code)} ${emoji(country_code)}`, queries]));

    const statsQueriesValues = statsGeneral.time_stats.combined_stats.overall;

    /**
     * Data from queries logs
     */
    const logsCodeValues = {};
    const logsDnssecValues = {};
    const logsFilterValues = {};
    const logsNetworkValues = {};
    const logsProtoValues = {};
    const logsTldValues = {};
    const logsTypeValues = {};

    const cacheDevices = new Set();

    for (const item of logs.items) {
        if (item.time_millis <= logsElementLastTimestamp) {
            break;
        }

        const isp = renameIsp(item.response.ip_info.network);
        const tld = item.request.domain.split('.').pop();

        object.count(logsCodeValues, item.response.dns_response_type);
        object.count(logsDnssecValues, item.request.dnssec);
        object.count(logsNetworkValues, isp);
        object.count(logsProtoValues, item.request.dns_proto_type);
        object.count(logsTypeValues, item.request.dns_request_type);

        tld !== 'https:'
            && object.count(logsTldValues, tld);

        item.response.filter_id
            && object.count(logsFilterValues, item.response.filter_id);

        const deviceName = deviceIdToName[item.device_id];
        const deviceIsp = `${deviceName} :: ${isp}`;
        cacheDevices.add(JSON.stringify({device: deviceName, withIsp: deviceIsp}));
    }

    logsElementLastTimestamp = logs.items[0].time_millis;

    /**
     * Data for online graph
     */
    let logsOnlineValues = {};

    for (const cached of cacheDevices) {
        const {device, withIsp} = JSON.parse(cached);
        const cacheDir = getCacheFileAbsPath().dirname;

        const parsedCacheDevices = [];

        try {
            const cachedData = await fs.readdir(cacheDir);

            parsedCacheDevices.push(...cachedData.map(data => {
                const [name, index] = data.split('_');
                return [name, Number(index)];
            }));
        } catch {
            await fs.mkdir(cacheDir, {recursive: true});
        }

        const found = parsedCacheDevices.find(([name]) => name === device);

        if (found) {
            [, logsOnlineValues[withIsp]] = found;
        } else {
            let i = 1;

            while (new Set(parsedCacheDevices.map(([, index]) => index)).has(i)) {
                i++;
            }

            await fs.writeFile(getCacheFileAbsPath(`${device}_${i}`).pathname, '');
            logsOnlineValues[withIsp] = i;
        }
    }

    if (!env.cloud.is) {
        console.log('not cloud, skip devices write:', logsOnlineValues);
        logsOnlineValues = {};
    }

    await influx.write([
        {meas: 'adg-categories', values: categoriesValues},
        {meas: 'adg-domains', values: domainsValues},
        {meas: 'adg-filters', values: filtersValues},
        {meas: 'adg-limits', values: limitsValues},

        {meas: 'adg-stats-clients', values: statsClientsValues},
        {meas: 'adg-stats-companies', values: statsCompaniesValues},
        {meas: 'adg-stats-countries', values: statsCountriesValues},
        {meas: 'adg-stats-queries', values: statsQueriesValues},

        {meas: 'adg-logs-code', values: logsCodeValues},
        {meas: 'adg-logs-dnssec', values: logsDnssecValues},
        {meas: 'adg-logs-filter', values: logsFilterValues},
        {meas: 'adg-logs-network', values: logsNetworkValues},
        {meas: 'adg-logs-online', values: logsOnlineValues},
        {meas: 'adg-logs-proto', values: logsProtoValues},
        {meas: 'adg-logs-tld', values: logsTldValues},
        {meas: 'adg-logs-type', values: logsTypeValues},
    ]);
};