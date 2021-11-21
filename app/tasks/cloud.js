'use strict';

const {shell, influx} = require('@k03mad/utils');

/***/
module.exports = async () => {
    const [uptime, df, free, ps] = await Promise.all([
        shell.run('uptime'),
        shell.run('df'),
        shell.run('free -b'),
        shell.run('ps -e | wc -l'),
    ]);

    const load = Number(uptime.match(/load average: (\d\.\d\d)/)[1].replace(',', '.'));
    const proc = Number(ps);
    const [, up] = uptime.match(/up(.+?),/);

    const disk = df.match(
        /\/dev\/vda2 +\d+ +(?<used>\d+) +(?<available>\d+)/,
    ).groups;

    const memory = free.match(
        /Mem: +(?<total>\d+) +(?<used>\d+) +(?<free>\d+) +(?<shared>\d+) +(?<buff>\d+) +(?<available>\d+)/,
    ).groups;

    Object.entries(disk).forEach(([key, value]) => {
        disk[key] = Number(value);
    });

    Object.entries(memory).forEach(([key, value]) => {
        memory[key] = Number(value);
    });

    await influx.write([
        {meas: 'cloud-usage-cpu', values: {load}},
        {meas: 'cloud-usage-disk', values: disk},
        {meas: 'cloud-usage-memory', values: memory},
        {meas: 'cloud-usage-proc', values: {proc}},
        {meas: 'cloud-usage-uptime', values: {up}},
    ]);
};
