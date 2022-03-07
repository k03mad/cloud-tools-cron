import {array, influx, ip, mikrotik, object, re} from '@k03mad/util';
import oui from 'oui';

const fillFirewallData = (data, fill) => {
    let lastComment;

    data.forEach(({bytes, comment}) => {
        comment
            ? lastComment = comment
            : comment = lastComment;

        if (!comment.includes('dummy rule')) {
            if (fill[comment]) {
                fill[comment] += Number(bytes);
            } else {
                fill[comment] = Number(bytes);
            }
        }
    });
};

/***/
export default async () => {
    const SEPARATOR = ' :: ';

    // 1 MB
    const connectionsMinBytes = 1_048_576;

    const commonPorts = new Set([
        21, 22, 53, 80,
        123, 443,
        8080,
    ]);

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
        '/ip/firewall/nat/print',
        '/ip/firewall/raw/print',
        '/system/package/update/print',
        '/system/scheduler/print',
        '/system/script/print',
    ].map(elem => mikrotik.post(elem)));

    const monitorTraffic = await Promise.all(
        interfaces.map(({name}) => mikrotik.post('interface/monitor-traffic', {
            interface: name,
            once: true,
        })),
    );

    const natTraffic = {};
    const filterTraffic = {};
    const rawTraffic = {};

    fillFirewallData(firewallNat, natTraffic);
    fillFirewallData(firewallFilter, filterTraffic);
    fillFirewallData(firewallRaw, rawTraffic);

    const interfacesSpeed = {};
    const interfacesTraffic = {};
    const wireguardTraffic = {};

    monitorTraffic.forEach(([obj]) => {
        interfacesSpeed[obj.name] = Number(obj['rx-bits-per-second']) + Number(obj['tx-bits-per-second']);
    });

    interfaces.forEach(elem => {
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
            const [vendor] = oui(mac).split('\n')[0].match(/^([\w-]+( \w+)?)/);
            key = vendor + SEPARATOR + mac;
        }

        clientsTraffic[key] = Number(elem.bytes.replace(',', '.'));
        clientsSignal[key] = Number(elem['signal-strength'].replace(/@.+/, ''));
    });

    const connectionsPorts = {};
    const connectionsProtocols = {};
    const connectionsSrc = {};
    const connectionsDomains = {};

    await Promise.all(firewallConnections.map(async elem => {
        const [dstAddress, port] = elem['dst-address'].split(':');
        const [srcAddress] = elem['src-address'].split(':');

        object.count(connectionsProtocols, elem.protocol);

        if (clientsIpToName[srcAddress]) {
            object.count(connectionsSrc, clientsIpToName[srcAddress]);
        }

        if (commonPorts.has(Number(port))) {
            object.count(connectionsPorts, port);
        }

        if (!re.isLocalIp(dstAddress) && !dstAddress?.includes('255')) {
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
    const dnsUnblocked = [];

    dnsCache.forEach(elem => {
        object.count(dnsCacheTypes, elem.type);

        if (elem.data?.startsWith('10.')) {
            dnsUnblocked.push(elem.name);
        }
    });

    const dnsUnblockedDomains = {};

    dnsUnblocked.sort().forEach((elem, i) => {
        dnsUnblockedDomains[elem] = i + 1;
    });

    await Promise.all([
        influx.write([
            {meas: 'mikrotik-address-list', values: addressListsCount},
            {meas: 'mikrotik-clients-signal', values: clientsSignal},
            {meas: 'mikrotik-connections-ports', values: connectionsPorts},
            {meas: 'mikrotik-connections-protocols', values: connectionsProtocols},
            {meas: 'mikrotik-connections-src', values: connectionsSrc},
            {meas: 'mikrotik-dns-cache', values: dnsCacheTypes},
            {meas: 'mikrotik-dns-unblocked', values: dnsUnblockedDomains},
            {meas: 'mikrotik-interfaces-speed', values: interfacesSpeed},
            {meas: 'mikrotik-scripts-run', values: {...scriptsRun, ...schedulerRun}},
            {meas: 'mikrotik-usage', values: health},
        ]),

        influx.append([
            {meas: 'mikrotik-clients-traffic', values: clientsTraffic},
            {meas: 'mikrotik-connections-traffic', values: connectionsDomains},
            {meas: 'mikrotik-filter-traffic', values: filterTraffic},
            {meas: 'mikrotik-interfaces-traffic', values: interfacesTraffic},
            {meas: 'mikrotik-nat-traffic', values: natTraffic},
            {meas: 'mikrotik-raw-traffic', values: rawTraffic},
            {meas: 'mikrotik-wireguard-traffic', values: wireguardTraffic},
        ]),
    ]);
};
