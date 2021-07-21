'use strict';

const {shell, influx} = require('@k03mad/utils');

/***/
module.exports = async () => {
    const apt = await shell.run([
        'sudo apt-get update',
        'sudo apt-get upgrade -u -s',
    ]);

    const values = {updates: apt.split('\n').filter(el => el.includes('Inst')).length};
    await influx.write({meas: 'cloud-updates', values});
};
