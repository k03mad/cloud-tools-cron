import {folder, influx} from '@k03mad/util';

/** */
export default async () => {
    const values = await folder.size('/var/lib/influxdb/data/*');
    await influx.write({meas: 'influx-dbs-size', values});
};
