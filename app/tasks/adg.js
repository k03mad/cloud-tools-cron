/* eslint-disable camelcase */
import {adg, array, influx, object} from '@k03mad/util';
import emoji from 'country-code-emoji';
import countries from 'i18n-iso-countries';
import fs from 'node:fs/promises';

import {getCacheFileAbsPath} from '../lib/utils.js';

const getCountryWithFlag = country => `${countries.alpha2ToAlpha3(country)} ${emoji(country)}`;

const renameIsp = isp => {
    const replaces = [
        ['CLOUDFLARENET', 'Cloudflare'],
        ['Net By Net Holding', 'NBN'],
        ['PVimpelCom', 'Beeline'],
        ['YANDEX', 'Yandex'],

        / (llc|ltd|gmbh)$/i,
        /^(c|p)?jsc /i,
    ];

    replaces.forEach(elem => {
        const [from, to = ''] = array.convert(elem);
        isp = isp.replace(from, to);
    });

    return isp.trim();
};

/** */
export default async () => {
    const CACHE_FOLDER = '.adg';
    const TIMESTAMP_FILE = '.timestamp';

    // 24h
    const timeTo = Date.now();
    const timeFrom = timeTo - 86_400_000;

    const {dirname: cacheDir, pathname: timestampPath} = getCacheFileAbsPath(CACHE_FOLDER, TIMESTAMP_FILE);
    await fs.mkdir(cacheDir, {recursive: true});

    const [
        account,
        devices,
        dnsServers,
        filters,

        logs,
    ] = await Promise.all([
        'account',
        'devices',
        'dns_servers',
        'filters',

        `query_log?time_from_millis=${timeFrom}&time_to_millis=${timeTo}&limit=100`,
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
    const statsAccountLimits = {...account.license.account_limits, ...account.license.request_limits};

    const statsFilterDomains = Object.fromEntries(filters
        .filter(({filter_id}) => enabledFilters[filter_id])
        .map(({filter_id, rules_count}) => [filter_id, rules_count]));

    const statsFilterCounts = {used: Object.keys(statsFilterDomains).length, all: filters.length};

    /**
     * Data from queries logs
     */
    const logsCategory = {};
    const logsCode = {};
    const logsCountryClient = {};
    const logsCountryServer = {};
    const logsDevice = {};
    const logsDnssec = {};
    const logsDomainBase = {};
    const logsFilter = {};
    const logsIsp = {};
    const logsProto = {};
    const logsRequestAllowed = {};
    const logsRequestBlocked = {};
    const logsSource = {};
    const logsStatus = {};
    const logsType = {};

    const cacheDevices = new Set();

    let logsElementLastTimestamp = 0;

    try {
        const timestampString = await fs.readFile(timestampPath, {encoding: 'utf8'});
        logsElementLastTimestamp = Number(timestampString);
    } catch {}

    for (const item of logs.items) {
        if (item.time_millis <= logsElementLastTimestamp) {
            break;
        }

        const deviceName = deviceIdToName[item.device_id];
        const isp = renameIsp(item.response.ip_info.network);
        const deviceIsp = `${deviceName} :: ${isp}`;

        const domainSplitted = item.request.domain.split('.');
        const baseDomain = domainSplitted.slice(-2).join('.').toLowerCase();

        cacheDevices.add(JSON.stringify({device: deviceName, withIsp: deviceIsp}));

        item.request.category_type !== 'OTHERS'
            && object.count(logsCategory, item.request.category_type);

        item.response.action_source
            && object.count(logsSource, item.response.action_source);

        item.response.action_status !== 'NONE'
            && object.count(logsStatus, item.response.action_status);

        item.response.action_status === 'REQUEST_ALLOWED'
            && !item.request.domain.endsWith('-ds.metric.gstatic.com')
            && object.count(logsRequestAllowed, item.request.domain);

        item.response.action_status === 'REQUEST_BLOCKED'
            && object.count(logsRequestBlocked, item.request.domain);

        item.response.filter_id
            && object.count(logsFilter, item.response.filter_id);

        item.response.ip_info.client_country
            && item.response.ip_info.client_country !== 'UNKNOWN_COUNTRY'
            && object.count(logsCountryClient, getCountryWithFlag(item.response.ip_info.client_country));

        item.response.ip_info.response_country
            && item.response.ip_info.response_country !== 'UNKNOWN_COUNTRY'
            && object.count(logsCountryServer, getCountryWithFlag(item.response.ip_info.response_country));

        object.count(logsCode, item.response.dns_response_type);
        object.count(logsDevice, deviceName);
        object.count(logsDnssec, item.request.dnssec);
        object.count(logsDomainBase, baseDomain);
        object.count(logsIsp, isp);
        object.count(logsProto, item.request.dns_proto_type);
        object.count(logsType, item.request.dns_request_type);
    }

    await fs.writeFile(timestampPath, String(logs.items[0].time_millis));

    /**
     * Data for online graph
     */
    const logsTimeline = {};

    for (const cached of cacheDevices) {
        const cachedData = await fs.readdir(cacheDir);

        const {device, withIsp} = JSON.parse(cached);
        const parsedCacheDevices = [];

        parsedCacheDevices.push(...cachedData.map(data => {
            const [name, index] = data.split('_');
            return [name, Number(index)];
        }));

        const found = parsedCacheDevices.find(([name]) => name === device);

        if (found) {
            [, logsTimeline[withIsp]] = found;
        } else {
            let i = 1;

            while (new Set(parsedCacheDevices.map(([, index]) => index)).has(i)) {
                i++;
            }

            await fs.writeFile(
                getCacheFileAbsPath(CACHE_FOLDER, `${device}_${i}`).pathname,
                '',
            );

            logsTimeline[withIsp] = i;
        }
    }

    await influx.write([
        {meas: 'adg-stats-filter-domains', values: statsFilterDomains},
        {meas: 'adg-stats-filter-counts', values: statsFilterCounts},
        {meas: 'adg-stats-account-limits', values: statsAccountLimits},

        {meas: 'adg-logs-category', values: logsCategory},
        {meas: 'adg-logs-code', values: logsCode},
        {meas: 'adg-logs-country-client', values: logsCountryClient},
        {meas: 'adg-logs-country-server', values: logsCountryServer},
        {meas: 'adg-logs-device', values: logsDevice},
        {meas: 'adg-logs-dnssec', values: logsDnssec},
        {meas: 'adg-logs-domain-base', values: logsDomainBase},
        {meas: 'adg-logs-filter', values: logsFilter},
        {meas: 'adg-logs-isp', values: logsIsp},
        {meas: 'adg-logs-proto', values: logsProto},
        {meas: 'adg-logs-request-allowed', values: logsRequestAllowed},
        {meas: 'adg-logs-request-blocked', values: logsRequestBlocked},
        {meas: 'adg-logs-source', values: logsSource},
        {meas: 'adg-logs-status', values: logsStatus},
        {meas: 'adg-logs-timeline', values: logsTimeline},
        {meas: 'adg-logs-type', values: logsType},
    ]);
};
