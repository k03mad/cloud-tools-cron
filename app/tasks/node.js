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

    const responses = (await Promise.all(reqResponses.map(async file => {
        try {
            const content = await fs.readFile(file, {encoding: 'utf-8'});
            const {statusCode, method, domain, timing, date, port} = JSON.parse(content);

            await fs.unlink(file);

            let reqString = `${statusCode} ${method} ${domain}`;

            if (port && ![80, 443].includes(port)) {
                reqString += `:${port}`;
            }

            const data = {
                values: {[reqString]: timing},
                timestamp: date,
            };

            if (Number([...String(statusCode)].shift()) >= 4) {
                return {meas: 'node-req-responses-fail', ...data};
            }

            return {meas: 'node-req-responses-ok', ...data};

        } catch {
            return null;
        }
    // eslint-disable-next-line unicorn/no-await-expression-member
    }))).filter(Boolean);

    JSON.parse(pm2).forEach(elem => {
        memory[elem.name] = elem.monit.memory;
        cpu[elem.name] = elem.monit.cpu;
        restarts[elem.name] = elem.pm2_env.restart_time;
    });

    const dataArr = [
        {meas: 'node-pm2-cpu', values: cpu},
        {meas: 'node-pm2-memory', values: memory},
        {meas: 'node-pm2-restarts', values: restarts},
        {meas: 'node-req-cache', values: {nodeCache: reqCache.length}},
    ];

    if (responses.length > 0) {
        dataArr.push(
            {meas: 'node-req-length', values: {count: responses.length}},
            ...responses,
        );
    }

    await influx.write(dataArr);
};
