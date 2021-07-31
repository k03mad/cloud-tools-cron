'use strict';

const {influx, folder} = require('@k03mad/utils');

/***/
module.exports = async () => {
    const values = await folder.size('/var/lib/influxdb/data/*');
    await influx.write({meas: 'influx-dbs-size', values});
};
