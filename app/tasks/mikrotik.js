'use strict';

const oui = require('oui');
const pMap = require('p-map');
const {influx, mikrotik, object, ip, array} = require('@k03mad/utils');

const fillFirewallData = (data, fill) => {
    let lastComment;

    data.forEach(({comment, bytes}) => {
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
module.exports = async () => {
    const SEPARATOR = ' :: ';

    const lookupConcurrency = 3;
    // 1 MB
    const connectionsMinBytes = 1_048_576;

    const clientsSignal = {};
    const clientsTraffic = {};
    const interfacesSpeed = {};
    const interfacesTraffic = {};
    const natTraffic = {};
    const filterTraffic = {};
    const rawTraffic = {};
    const connectionsDomains = {};

    const [
        interfaces,
        wifiClients,
        dhcpLeases,
        dnsCache,
        adressList,
        firewallConnections,
        firewallFilter,
        firewallNat,
        firewallRaw,
        [, updates],
        [usage],
        scheduler,
        scripts,

    ] = await mikrotik.write([
        ['/interface/print'],
        ['/interface/wireless/registration-table/print'],
        ['/ip/dhcp-server/lease/print'],
        ['/ip/dns/cache/print'],
        ['/ip/firewall/address-list/print'],
        ['/ip/firewall/connection/print'],
        ['/ip/firewall/filter/print'],
        ['/ip/firewall/nat/print'],
        ['/ip/firewall/raw/print'],
        ['/system/package/update/check-for-updates'],
        ['/system/resource/print'],
        ['/system/scheduler/print'],
        ['/system/script/print'],
    ]);

    fillFirewallData(firewallNat, natTraffic);
    fillFirewallData(firewallFilter, filterTraffic);
    fillFirewallData(firewallRaw, rawTraffic);

    const monitorTraffic = await mikrotik.write(
        interfaces.map(elem => ['/interface/monitor-traffic', `=interface=${elem.name}`, '=once']),
    );

    monitorTraffic.forEach(([obj]) => {
        interfacesSpeed[`${obj.name}_rx`] = Number(obj['rx-bits-per-second']);
        interfacesSpeed[`${obj.name}_tx`] = Number(obj['tx-bits-per-second']);
    });

    interfaces.forEach(elem => {
        interfacesTraffic[`${elem.name}_rx`] = Number(elem['rx-byte']);
        interfacesTraffic[`${elem.name}_tx`] = Number(elem['tx-byte']);

        const sum = Number(elem['rx-byte']) + Number(elem['tx-byte']);

        if (elem.name.includes('ether') && sum > 0) {
            clientsTraffic[elem.name] = sum;
        }
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

    await pMap(firewallConnections, async elem => {
        const address = elem['dst-address'].replace(/:.+/, '');

        if (!ip.isLocal(address) && !address?.includes('255')) {
            const bytes = Number(elem['orig-bytes']) + Number(elem['repl-bytes']);

            if (bytes > connectionsMinBytes) {
                try {
                    const {hostname} = await ip.info(address);

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
    }, {concurrency: lookupConcurrency});

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
        dnsCache: dnsCache.length,
    };

    const scriptsRun = array.mergeCol(scripts.map(elem => ({[elem.name]: Number(elem['run-count'])})));
    const schedulerRun = array.mergeCol(scheduler.map(elem => ({[elem.name]: Number(elem['run-count'])})));

    await influx.write([
        {meas: 'mikrotik-clients-signal', values: clientsSignal},
        {meas: 'mikrotik-interfaces-speed', values: interfacesSpeed},
        {meas: 'mikrotik-usage', values: health},
        {meas: 'mikrotik-scripts-run', values: {...scriptsRun, ...schedulerRun}},
        {meas: 'mikrotik-adress-list', values: array.count(adressList.map(elem => elem.list))},
    ]);

    await influx.append([
        {meas: 'mikrotik-clients-traffic', values: clientsTraffic},
        {meas: 'mikrotik-connections-traffic', values: connectionsDomains},
        {meas: 'mikrotik-interfaces-traffic', values: interfacesTraffic},
        {meas: 'mikrotik-nat-traffic', values: natTraffic},
        {meas: 'mikrotik-filter-traffic', values: filterTraffic},
        {meas: 'mikrotik-raw-traffic', values: rawTraffic},
    ]);
};
