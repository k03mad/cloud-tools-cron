import utils from '@k03mad/util';

const {folder, influx} = utils;

/***/
export default async () => {
    const values = await folder.size('/var/lib/influxdb/data/*');
    await influx.write({meas: 'influx-dbs-size', values});
};
