'use strict';

const env = require('../../env');
const {promises: fs} = require('fs');
const {shell} = require('@k03mad/utils');

const gitFolder = `${env.fs.home}/git/`;

/***/
module.exports = async () => {
    const ls = await shell.run(`ls -1 ${gitFolder}`);

    await Promise.all(ls.split('\n').map(async elem => {
        const folderPath = gitFolder + elem;
        const stat = await fs.lstat(folderPath);

        if (stat.isDirectory()) {
            await shell.run([
                `cd ${folderPath}`,
                'git pull',
            ]);
        }
    }));
};
