import {influx, shell} from '@k03mad/util';

/***/
export default async () => {
    const ufw = await shell.run('sudo ufw status');

    const count = ufw.split('\n').slice(4).length;
    await influx.write({meas: 'ufw-rules-count', values: {count}});
};
