import utils from '@k03mad/util';

const {influx, shell} = utils;

/***/
export default async () => {
    const ufw = await shell.run('sudo ufw status');

    const count = ufw.split('\n').slice(4).length;
    await influx.write({meas: 'ufw-rules-count', values: {count}});
};
