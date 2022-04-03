import {cloud, influx, ip, next, object} from '@k03mad/util';
import fs from 'node:fs/promises';
import path from 'node:path';

import env from '../../env.js';
import {renameIsp} from '../lib/utils.js';

const getCacheFileAbsPath = (file = 'foo') => {
    const {pathname} = new URL(`../../.devices/${file}`, import.meta.url);
    return {pathname, dirname: path.dirname(pathname)};
};

const mapValues = (
    data, {key = 'name', value = 'queries'} = {},
) => Object.fromEntries(
    data
        .filter(elem => elem[key])
        .map(elem => [elem[key], elem[value]]),
);

let logsElementLastTimestamp = 0;

/** */
export default async () => {
    await next.auth();

    const [
        topRoot,
        topDomainsBlocked,
        topDomainsResolved,
        lists,
        {logs},
    ] = await Promise.all([
        ...[
            'top_root_domains',
            'top_domains/blocked',
            'top_domains/resolved',
        ].map(req => next.query({
            path: `analytics/${req}`,
            searchParams: {from: '-6h', timezoneOffset: '-180', selector: true},
        })),

        next.query({path: 'privacy'}),
        next.query({path: 'logs'}),
    ]);

    const logsLists = {};
    const logsProtocol = {};
    const logsStatus = {};
    const logsDnssec = {};
    const logsType = {};
    const logsDomain = {};
    const logsDevice = {};
    const logsIsp = {};
    const logsCity = {};
    let logsDeviceIsp = {};

    const cacheDevices = new Set();

    const notify = [];

    await Promise.all(logs.map(async elem => {
        if (elem.timestamp > logsElementLastTimestamp) {
            object.count(logsStatus, elem.status);
            object.count(logsDnssec, elem.dnssec);
            object.count(logsType, elem.type);
            object.count(logsProtocol, elem.protocol);

            if (elem.name.includes('.')) {
                object.count(logsDomain, elem.name.split('.').pop());
            }

            elem.lists.forEach(list => {
                object.count(logsLists, list);
            });

            const geo = await ip.lookup(elem.clientIp);
            const isp = renameIsp(geo.isp);

            object.count(logsCity, geo.city || geo.countryname);
            object.count(logsIsp, isp);

            if (elem.deviceName) {
                object.count(logsDevice, elem.deviceName);

                const deviceIsp = `${elem.deviceName} :: ${isp}`;
                cacheDevices.add(JSON.stringify({device: elem.deviceName, withIsp: deviceIsp}));
            }
        }
    }));

    logsElementLastTimestamp = logs[0].timestamp;

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
            [, logsDeviceIsp[withIsp]] = found;
        } else {
            let i = 1;

            while (new Set(parsedCacheDevices.map(([, index]) => index)).has(i)) {
                i++;
            }

            await fs.writeFile(getCacheFileAbsPath(`${device}_${i}`).pathname, '');
            logsDeviceIsp[withIsp] = i;
        }
    }

    if (!env.cloud.is) {
        console.log('not cloud, skip devices write:', logsDeviceIsp);
        logsDeviceIsp = {};
    }

    if (notify.length > 0) {
        await cloud.notify({text: notify.join('\n'), parse_mode: ''});
    }

    await influx.write([
        {meas: 'next-entries-lists', values: mapValues(lists.blocklists, {key: 'id', value: 'entries'})},

        {meas: 'next-top-domains-blocked', values: mapValues(topDomainsBlocked)},
        {meas: 'next-top-domains-resolved', values: mapValues(topDomainsResolved)},
        {meas: 'next-top-root', values: mapValues(topRoot)},

        {meas: 'next-logs-city', values: logsCity},
        {meas: 'next-logs-device-isp', values: logsDeviceIsp},
        {meas: 'next-logs-device', values: logsDevice},
        {meas: 'next-logs-dnssec', values: logsDnssec},
        {meas: 'next-logs-domain', values: logsDomain},
        {meas: 'next-logs-isp', values: logsIsp},
        {meas: 'next-logs-lists', values: logsLists},
        {meas: 'next-logs-protocol', values: logsProtocol},
        {meas: 'next-logs-status', values: logsStatus},
        {meas: 'next-logs-type', values: logsType},
    ]);
};
