'use strict';

const {syncthing, array, influx, folder} = require('@k03mad/utils');

/** @returns {Promise} */
module.exports = async () => {
    const bytes = {};
    const addresses = {};

    const paths = [
        'config',
        'system/connections',
        'system/discovery',
        'system/error',
        'system/log',
    ];

    const [
        {devices},
        {connections},
        discovery,
        {errors},
        {messages},
        sizes,
    ] = await Promise.all([
        ...paths.map(path => syncthing.get(path)),
        folder.size('~/Syncthing/*'),
    ]);

    Object.entries(connections).forEach(([device, data]) => {
        const {name} = devices.find(elem => elem.deviceID === device);
        bytes[`${name}_in`] = data.inBytesTotal;
        bytes[`${name}_out`] = data.outBytesTotal;
    });

    Object.entries(discovery).forEach(([device, data]) => {
        const {name} = devices.find(elem => elem.deviceID === device);
        const protocols = data.addresses.map(elem => `${name}_${elem.split(':')[0]}`);
        Object.assign(addresses, array.count(protocols));
    });

    await influx.write([
        {meas: 'syncthing-bytes', values: bytes},
        {meas: 'syncthing-addresses', values: addresses},
        {meas: 'syncthing-sizes', values: sizes},
        {meas: 'syncthing-log', values: {
            errors: errors?.length || 0,
            ...array.count(messages.map(elem => `log_level_${elem.level}`)),
        }},
    ]);
};
