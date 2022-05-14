import {array, influx, ip, mikrotik, object, re, string} from '@k03mad/util';
import {Netmask} from 'netmask';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import oui from 'oui';

const fillFirewallData = (data, fill) => {
    let lastComment;

    data.forEach(({bytes, comment, disabled = 'false'}) => {
        comment
            ? lastComment = comment
            : comment = lastComment;

        if (
            disabled === 'false'
            && !comment.includes('dummy rule')
        ) {
            if (fill[comment]) {
                fill[comment] += Number(bytes);
            } else {
                fill[comment] = Number(bytes);
            }
        }
    });
};

const getFileUrl = file => new URL(`../../.mikrotik/${file}`, import.meta.url).pathname;

const getCacheFileAbsPath = file => {
    const pathname = getFileUrl(file);
    return {pathname, dirname: path.dirname(pathname)};
};

/** */
export default async () => {
    const SEPARATOR = ' :: ';

    // 1 MB
    const connectionsMinBytes = 1_048_576;

    const [usage] = await mikrotik.post('/system/resource/print');

    const [
        interfaces,
        wifiClients,
        wireguard,
        dhcpLeases,
        dnsCache,
        addressList,
        firewallConnections,
        firewallFilter,
        firewallMangle,
        firewallNat,
        firewallRaw,
        [updates],
        scheduler,
        scripts,
    ] = await Promise.all([
        '/interface/print',
        '/interface/wireless/registration-table/print',
        '/interface/wireguard/peers/print',
        '/ip/dhcp-server/lease/print',
        '/ip/dns/cache/all/print',
        '/ip/firewall/address-list/print',
        '/ip/firewall/connection/print',
        '/ip/firewall/filter/print',
        '/ip/firewall/mangle/print',
        '/ip/firewall/nat/print',
        '/ip/firewall/raw/print',
        '/system/package/update/print',
        '/system/scheduler/print',
        '/system/script/print',
    ].map(elem => mikrotik.post(elem)));

    const interfacesEnabled = interfaces.filter(({disabled}) => disabled === 'false');

    const monitorTraffic = await Promise.all(
        interfacesEnabled.map(({name}) => mikrotik.post('interface/monitor-traffic', {
            interface: name,
            once: true,
        })),
    );

    const mangleTraffic = {};
    const natTraffic = {};
    const filterTraffic = {};
    const rawTraffic = {};

    fillFirewallData(firewallMangle, mangleTraffic);
    fillFirewallData(firewallNat, natTraffic);
    fillFirewallData(firewallFilter, filterTraffic);
    fillFirewallData(firewallRaw, rawTraffic);

    const interfacesSpeed = {};
    const interfacesTraffic = {};
    const wireguardTraffic = {};

    monitorTraffic.forEach(([obj]) => {
        interfacesSpeed[obj.name] = Number(obj['rx-bits-per-second']) + Number(obj['tx-bits-per-second']);
    });

    interfacesEnabled.forEach(elem => {
        interfacesTraffic[elem.name] = Number(elem['rx-byte']) + Number(elem['tx-byte']);
    });

    wireguard.forEach(elem => {
        wireguardTraffic[elem.comment] = Number(elem.rx) + Number(elem.tx);
    });

    const clientsSignal = {};
    const clientsTraffic = {};
    const clientsIpToName = {};

    dhcpLeases.forEach(elem => {
        clientsIpToName[elem['active-address'] || elem.address] = elem.comment;
    });

    wifiClients.forEach(elem => {
        const mac = elem['mac-address'];
        const client = dhcpLeases.find(lease => lease['mac-address'] === mac);

        let key;

        if (client && client.comment) {
            key = client.comment;
        } else {
            const [vendor] = oui(mac)?.split('\n')[0].match(/^([\w-]+( \w+)?)/) || [];
            key = vendor ? vendor + SEPARATOR + mac : mac;
        }

        clientsTraffic[key] = Number(elem.bytes.replace(',', '.'));
        clientsSignal[key] = Number(elem['signal-strength'].replace(/@.+/, ''));
    });

    const connectionsProtocols = {};
    const connectionsDomains = {};

    await Promise.all(firewallConnections.map(async elem => {
        const [dstAddress] = elem['dst-address']?.split(':') || [];

        object.count(connectionsProtocols, elem.protocol);

        if (
            dstAddress
            && !re.isLocalIp(dstAddress)
            && !dstAddress?.includes('255')
        ) {
            const bytes = Number(elem['orig-bytes']) + Number(elem['repl-bytes']);

            if (bytes > connectionsMinBytes) {
                try {
                    const {hostname} = await ip.info(dstAddress);

                    if (hostname) {
                        const domain = hostname.split('.').slice(-2).join('.');
                        object.count(connectionsDomains, domain, bytes);
                    }
                } catch (err) {
                    if (err.response && err.response.statusCode === 429) {
                        return;
                    }

                    throw err;
                }
            }
        }
    }));

    const memTotal = Number(usage['total-memory']);
    const hddTotal = Number(usage['total-hdd-space']);

    const health = {
        mem: memTotal - Number(usage['free-memory']),
        memTotal,
        hdd: hddTotal - Number(usage['free-hdd-space']),
        hddTotal,
        cpu: Number(usage['cpu-load']),
        cpuFreq: Number(usage['cpu-frequency']),
        uptime: usage.uptime,
        updates: `${updates['installed-version']}/${updates['latest-version']}`,
    };

    const scriptsRun = Object.assign(...scripts.map(elem => ({[elem.name]: Number(elem['run-count'])})));
    const schedulerRun = Object.assign(...scheduler.map(elem => ({[elem.name]: Number(elem['run-count'])})));

    const addressListsCount = array.count(addressList.map(elem => elem.list));

    const dnsCacheTypes = {};

    dnsCache.forEach(elem => {
        if (!elem.type || elem.type.includes('unknown')) {
            elem.type = 'unknown';
        }

        object.count(dnsCacheTypes, elem.type);
    });

    const domainsToWarpInDns = new Set();

    dnsCache.forEach(entry => {
        if (
            entry.data !== '0.0.0.0'
            && net.isIPv4(entry.data)
        ) {
            for (const elem of addressList) {
                if (
                    elem.list === 'towarp'
                ) {
                    if (elem.address.includes('/')) {
                        if (new Netmask(elem.address).contains(entry.data)) {
                            domainsToWarpInDns.add(entry.name);
                        }
                    } else if (elem.address === entry.data) {
                        domainsToWarpInDns.add(entry.name);
                    }
                }
            }
        }
    });

    const domainsUnblocked = {};

    for (const domain of domainsToWarpInDns) {
        const cacheDir = getCacheFileAbsPath().dirname;

        const cacheDomains = [];

        try {
            const cachedData = await fs.readdir(cacheDir);

            cacheDomains.push(...cachedData.map(data => {
                const [name, index] = data.split('_');
                return [name, Number(index)];
            }));
        } catch {
            await fs.mkdir(cacheDir, {recursive: true});
        }

        const found = cacheDomains.find(([name]) => name === domain);

        if (found) {
            [, domainsUnblocked[domain]] = found;
        } else {
            let i = 1;

            while (new Set(cacheDomains.map(([, index]) => index)).has(i)) {
                i++;
            }

            await fs.writeFile(getCacheFileAbsPath(`${string.filenamify(domain)}_${i}`).pathname, '');
            domainsUnblocked[domain] = i;
        }
    }

    await Promise.all([
        influx.write([
            {meas: 'mikrotik-address-list', values: addressListsCount},
            {meas: 'mikrotik-clients-signal', values: clientsSignal},
            {meas: 'mikrotik-connections-protocols', values: connectionsProtocols},
            {meas: 'mikrotik-dns-cache', values: dnsCacheTypes},
            {meas: 'mikrotik-domains-unblocked', values: domainsUnblocked},
            {meas: 'mikrotik-interfaces-speed', values: interfacesSpeed},
            {meas: 'mikrotik-scripts-run', values: {...scriptsRun, ...schedulerRun}},
            {meas: 'mikrotik-usage', values: health},
        ]),

        influx.append([
            {meas: 'mikrotik-clients-traffic', values: clientsTraffic},
            {meas: 'mikrotik-connections-traffic', values: connectionsDomains},
            {meas: 'mikrotik-filter-traffic', values: filterTraffic},
            {meas: 'mikrotik-interfaces-traffic', values: interfacesTraffic},
            {meas: 'mikrotik-mangle-traffic', values: mangleTraffic},
            {meas: 'mikrotik-nat-traffic', values: natTraffic},
            {meas: 'mikrotik-raw-traffic', values: rawTraffic},
            {meas: 'mikrotik-wireguard-traffic', values: wireguardTraffic},
        ]),
    ]);
};
