import utils from '@k03mad/util';

const {influx, shell} = utils;

/***/
export default async () => {
    const f2bJails = ['grafana', 'sshd'];

    const banned = {};

    await Promise.all(f2bJails.map(async jail => {
        const log = await shell.run(`sudo fail2ban-client status ${jail}`);
        banned[jail] = Number(log.match(/Currently banned:\s+(\d+)/)[1]);
    }));

    await influx.write({meas: 'f2b-jail-bans', values: banned});
};
