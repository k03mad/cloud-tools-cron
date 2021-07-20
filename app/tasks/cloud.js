'use strict';

const globby = require('globby');
const hasha = require('hasha');
const os = require('os');
const path = require('path');
const {shell, influx} = require('@k03mad/utils');

/***/
module.exports = async () => {
    const memory = {};
    const cpu = {};
    const restarts = {};
    const banned = {};

    const f2b = {
        grafana: 'sudo fail2ban-client status grafana',
        sshd: 'sudo fail2ban-client status sshd',
    };

    const uptime = await shell.run('uptime');
    const disk = await shell.run('df');
    const ram = await shell.run('free -m');
    const pm2 = await shell.run('pm2 jlist');

    const cacheFiles = await globby(path.join(os.tmpdir(), hasha('').slice(0, 10)));

    JSON.parse(pm2).forEach(elem => {
        memory[elem.name] = elem.monit.memory;
        cpu[elem.name] = elem.monit.cpu;
        restarts[elem.name] = elem.pm2_env.restart_time;
    });

    await Promise.all(Object.entries(f2b).map(async ([key, value]) => {
        const log = await shell.run(value);
        banned[key] = Number(log.match(/Currently banned:\s+(\d+)/)[1]);
    }));

    const usage = {
        ramUsage: Number(ram.match(/Mem: +\d+ +(\d+)/)[1]),
        cpuLoad: Number(uptime.match(/load average: (\d\.\d\d)/)[1].replace(',', '.')),
        diskUsage: Number(disk.match(/\/dev\/vda2 +\d+ +(\d+)/)[1]),
        uptime: `Uptime: ${uptime.match(/up(.+?),/)[1]}`,
        nodeCache: cacheFiles.length,
        banned: Number(banned.match(/Currently banned:\s+(\d+)/)[1]),
    };

    await influx.write([
        {meas: 'cloud-node-cpu', values: cpu},
        {meas: 'cloud-node-memory', values: memory},
        {meas: 'cloud-node-restarts', values: restarts},
        {meas: 'cloud-usage', values: usage},
        {meas: 'cloud-banned', values: banned},
    ]);
};
