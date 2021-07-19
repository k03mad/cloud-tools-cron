'use strict';

const globby = require('globby');
const os = require('os');
const path = require('path');
const {influx} = require('@k03mad/utils');
const {promises: fs} = require('fs');

/***/
module.exports = async () => {
    const requestFiles = await globby(path.join(os.tmpdir(), '_req_stats'));

    const data = await Promise.all(requestFiles.map(async file => {
        const content = await fs.readFile(file, {encoding: 'utf-8'});

        try {
            const {statusCode, method, domain, timing, date} = JSON.parse(content);

            return {
                meas: 'cloud-node-request',
                values: {[`${statusCode} ${method} ${domain}`]: timing},
                timestamp: date,
            };
        } catch {}

        await fs.unlink(file);
        return null;
    }));

    await influx.write(data.filter(Boolean));
};
