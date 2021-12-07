import utils from '@k03mad/util';

const {influx, shell} = utils;

/***/
export default async () => {
    const apt = await shell.run([
        'sudo apt-get update',
        'sudo apt-get upgrade -u -s',
    ]);

    const values = {updates: apt.split('\n').filter(el => el.includes('Inst')).length};
    await influx.write({meas: 'cloud-updates', values});
};
