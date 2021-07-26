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
    const gitSizes = {};

    const [pm2, du, reqCache, reqResponses] = await Promise.all([
        shell.run('pm2 jlist'),
        shell.run('du -s ~/git/*'),
        globby(path.join(os.tmpdir(), hasha('').slice(0, 10))),
        globby(path.join(os.tmpdir(), '_req_stats')),
    ]);

    [...du.matchAll(/(\d+)\s+([\w/-]+)/g)]
        .forEach(([, count, folder]) => {
            const folderName = folder.split('/').pop();
            gitSizes[folderName] = Number(count);
        });

    const responses = await Promise.all(reqResponses.map(async file => {
        try {
            const content = await fs.readFile(file, {encoding: 'utf-8'});
            const {statusCode, method, domain, timing, date} = JSON.parse(content);

            await fs.unlink(file);
            return {
                meas: 'node-req-responses',
                values: {[`${statusCode} ${method} ${domain}`]: timing},
                timestamp: date,
            };
        } catch {
            return null;
        }
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
        {meas: 'node-repo-size', values: gitSizes},
        {meas: 'node-req-cache', values: {nodeCache: reqCache.length}},
        ...responses.filter(Boolean),
    ]);
};
