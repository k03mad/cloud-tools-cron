import utils from '@k03mad/util';
import _ from 'lodash';

const {influx, shell} = utils;

/***/
export default async () => {
    const cmd = {
        load: 'uptime',
        uptime: 'uptime -p',
        df: 'df',
        mem: 'free -b',
        ps: 'ps -e | wc -l',
        certbot: 'sudo certbot certificates',
        pkg: "dpkg-query -l | grep -c '^ii'",
        ports: 'sudo lsof -i -P -n | grep LISTEN',
    };

    const re = {
        load: /load average(s)?: (\d[,.]\d\d)/,
        disk: /\/dev\/vda2 +\d+ +(?<used>\d+) +(?<available>\d+)/,
        mem: /Mem: +(?<total>\d+) +(?<used>\d+) +(?<free>\d+) +(?<shared>\d+) +(?<buff>\d+) +(?<available>\d+)/,
        ports: {
            listen: /^(?<name>\S+)\s.+:(?<port>\d+) \(LISTEN\)/,
            sanitize: /\\x\d+\//g,
        },
        cert: {
            domains: /Domains: (.+)/g,
            valid: /VALID: (\d+)/g,
        },
    };

    await Promise.all(
        Object
            .entries(cmd)
            .map(async ([key, value]) => {
                cmd[key] = await shell.run(value);
            }),
    );

    // uptime
    cmd.uptime = cmd.uptime
        .replace('up ', '')
        .replace(/ week(s)?, /, 'w')
        .replace(/ day(s)?, /, 'd')
        .replace(/ hour(s)?, /, 'h')
        .replace(/ minute(s)?/, 'm')
        .trim();

    // cpu
    cmd.load = Number(cmd.load.match(re.load)[2].replace(',', '.'));

    // certs
    const domains = [...cmd.certbot.matchAll(re.cert.domains)].map(elem => elem[1]);
    const valid = [...cmd.certbot.matchAll(re.cert.valid)].map(elem => Number(elem[1]));

    domains.forEach((domain, i) => {
        if (typeof cmd.certbot === 'object') {
            cmd.certbot[domain] = valid[i];
        } else {
            cmd.certbot = {[domain]: valid[i]};
        }
    });

    // disk
    Object
        .entries(cmd.df.match(re.disk).groups)
        .forEach(([key, value]) => {
            if (typeof cmd.df === 'object') {
                cmd.df[key] = Number(value);
            } else {
                cmd.df = {[key]: Number(value)};
            }
        });

    // mem
    Object
        .entries(cmd.mem.match(re.mem).groups)
        .forEach(([key, value]) => {
            if (typeof cmd.mem === 'object') {
                cmd.mem[key] = Number(value);
            } else {
                cmd.mem = {[key]: Number(value)};
            }
        });

    // ports
    const tempPorts = {};

    cmd.ports
        .split('\n')
        .forEach(elem => {
            const matched = elem.match(re.ports.listen)?.groups;

            if (matched) {
                tempPorts[matched.port] = matched.name.replace(re.ports.sanitize, '');
            }
        });

    Object.entries(_.invertBy(tempPorts)).forEach(([name, ports]) => {
        ports.map(Number).sort((a, b) => a - b).forEach((port, i, arr) => {
            const key = arr.length > 1 && i > 0 ? `${name}_${++i}` : name;

            if (typeof cmd.ports === 'object') {
                cmd.ports[key] = port;
            } else {
                cmd.ports = {[key]: port};
            }
        });
    });

    await influx.write([
        {meas: 'cloud-usage-certs', values: cmd.certbot},
        {meas: 'cloud-usage-cpu', values: {load: cmd.load}},
        {meas: 'cloud-usage-disk', values: cmd.df},
        {meas: 'cloud-usage-memory', values: cmd.mem},
        {meas: 'cloud-usage-packages', values: {pkg: Number(cmd.pkg)}},
        {meas: 'cloud-usage-ports', values: cmd.ports},
        {meas: 'cloud-usage-process', values: {process: Number(cmd.ps)}},
        {meas: 'cloud-usage-uptime', values: {uptime: cmd.uptime}},
    ]);
};
