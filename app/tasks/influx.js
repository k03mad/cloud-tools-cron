'use strict';

const {shell, influx} = require('@k03mad/utils');

/***/
module.exports = async () => {
    const path = '/var/lib/influxdb/data/';
    const dbs = ['_internal', 'mad', 'opentsdb'];

    const size = {};

    await Promise.all(dbs.map(async db => {
        const log = await shell.run(`sudo du -s ${path + db}`);
        size[db] = Number(log.match(/^\d+/)[0]);
    }));

    await influx.write({meas: 'influx-dbs-size', values: size});
};
