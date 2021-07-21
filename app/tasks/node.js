'use strict';

const globby = require('globby');
const hasha = require('hasha');
const os = require('os');
const path = require('path');
const {promises: fs} = require('fs');
const {shell, influx} = require('@k03mad/utils');

/***/
module.exports = async () => {
    const memory = {};
    const cpu = {};
    const restarts = {};

    const [pm2, reqCache, reqResponses] = await Promise.all([
        shell.run('pm2 jlist'),
        globby(path.join(os.tmpdir(), hasha('').slice(0, 10))),
        globby(path.join(os.tmpdir(), '_req_stats')),
    ]);

    const responses = await Promise.all(reqResponses.map(async file => {
        const content = await fs.readFile(file, {encoding: 'utf-8'});

        try {
            const {statusCode, method, domain, timing, date} = JSON.parse(content);

            return {
                meas: 'node-req',
                values: {[`${statusCode} ${method} ${domain}`]: timing},
                timestamp: date,
            };
        } catch {}

        await fs.unlink(file);
        return null;
    }));

    JSON.parse(pm2).forEach(elem => {
        memory[elem.name] = elem.monit.memory;
        cpu[elem.name] = elem.monit.cpu;
        restarts[elem.name] = elem.pm2_env.restart_time;
    });

    await influx.write([
        {meas: 'node-pm2-cpu', values: cpu},
        {meas: 'node-pm2-memory', values: memory},
        {meas: 'node-pm2-restarts', values: restarts},
        {meas: 'node-req-cache', values: {nodeCache: reqCache.length}},
        ...responses.filter(Boolean),
    ]);
};
