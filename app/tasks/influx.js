'use strict';

const {shell, influx} = require('@k03mad/utils');

/***/
module.exports = async () => {
    const values = {};

    const du = await shell.run('sudo du -s /var/lib/influxdb/data/*');

    [...du.matchAll(/(\d+)\s+([\w/-]+)/g)]
        .forEach(([, count, folder]) => {
            const folderName = folder.split('/').pop();
            values[folderName] = Number(count);
        });

    await influx.write({meas: 'influx-dbs-size', values});
};
