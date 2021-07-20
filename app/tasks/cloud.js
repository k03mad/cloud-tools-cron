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

    const f2bJails = ['grafana', 'sshd'];

    const [uptime, disk, ram, pm2, cacheFiles] = await Promise.all([
        shell.run('uptime'),
        shell.run('df'),
        shell.run('free -m'),
        shell.run('pm2 jlist'),

        globby(path.join(os.tmpdir(), hasha('').slice(0, 10))),

        Promise.all(f2bJails.map(async jail => {
            const log = await shell.run(`sudo fail2ban-client status ${jail}`);
            banned[jail] = Number(log.match(/Currently banned:\s+(\d+)/)[1]);
        })),
    ]);

    JSON.parse(pm2).forEach(elem => {
        memory[elem.name] = elem.monit.memory;
        cpu[elem.name] = elem.monit.cpu;
        restarts[elem.name] = elem.pm2_env.restart_time;
    });

    const usage = {
        ramUsage: Number(ram.match(/Mem: +\d+ +(\d+)/)[1]),
        cpuLoad: Number(uptime.match(/load average: (\d\.\d\d)/)[1].replace(',', '.')),
        diskUsage: Number(disk.match(/\/dev\/vda2 +\d+ +(\d+)/)[1]),
        uptime: `Uptime: ${uptime.match(/up(.+?),/)[1]}`,
        nodeCache: cacheFiles.length,
    };

    await influx.write([
        {meas: 'cloud-node-cpu', values: cpu},
        {meas: 'cloud-node-memory', values: memory},
        {meas: 'cloud-node-restarts', values: restarts},
        {meas: 'cloud-usage', values: usage},
        {meas: 'cloud-banned', values: banned},
    ]);
};
