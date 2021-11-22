'use strict';

const env = require('../../env');
const {promises: fs} = require('fs');
const {shell, influx, folder} = require('@k03mad/utils');

/***/
module.exports = async () => {
    const gitFolder = `${env.fs.home}/git/`;

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

    const sizes = await folder.size(`${gitFolder}*`, {trim: gitFolder});
    await influx.write({meas: 'git-repo-size', values: sizes});
};
