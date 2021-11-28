'use strict';

const {shell, influx} = require('@k03mad/utils');

/***/
module.exports = async () => {
    const ufw = await shell.run('sudo ufw status');

    const count = ufw.split('\n').slice(4).length;
    await influx.write({meas: 'ufw-rules-count', values: {count}});
};
