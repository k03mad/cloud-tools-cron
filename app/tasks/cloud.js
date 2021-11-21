'use strict';

const {shell, influx} = require('@k03mad/utils');

/***/
module.exports = async () => {
    const cmd = [
        'uptime',
        "awk '{print $1}' /proc/uptime",
        'df',
        'free -b',
        'ps -e | wc -l',
    ];

    const re = {
        load: /load average: (\d\.\d\d)/,
        disk: /\/dev\/vda2 +\d+ +(?<used>\d+) +(?<available>\d+)/,
        mem: /Mem: +(?<total>\d+) +(?<used>\d+) +(?<free>\d+) +(?<shared>\d+) +(?<buff>\d+) +(?<available>\d+)/,
        dns: /Query time: (\d+) msec/,
    };

    const dns = {
        cloudflare: '1.1.1.1',
        google: '8.8.8.8',
        yandex: '77.88.8.8',
        adguard: '94.140.14.14',
    };

    const [uptime, proc, df, free, ps, ...dig] = await Promise.all(
        [
            ...cmd,
            ...Object.values(dns).map(elem => `dig example.com @${elem}`),
        ].map(elem => shell.run(elem)),
    );

    const load = Number(uptime.match(re.load)[1].replace(',', '.'));

    const disk = df.match(re.disk).groups;
    const memory = free.match(re.mem).groups;

    Object.entries(disk).forEach(([key, value]) => {
        disk[key] = Number(value);
    });

    Object.entries(memory).forEach(([key, value]) => {
        memory[key] = Number(value);
    });

    Object.keys(dns).forEach((key, i) => {
        dns[key] = Number(dig[i].match(re.dns)[1]);
    });

    await influx.write([
        {meas: 'cloud-usage-cpu', values: {load}},
        {meas: 'cloud-usage-disk', values: disk},
        {meas: 'cloud-usage-dns', values: dns},
        {meas: 'cloud-usage-memory', values: memory},
        {meas: 'cloud-usage-process', values: {process: Number(ps)}},
        {meas: 'cloud-usage-uptime', values: {uptime: Number(proc)}},
    ]);
};
