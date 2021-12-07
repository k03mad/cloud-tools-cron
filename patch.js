import utils from '@k03mad/util';
import chalk from 'chalk';
import fs from 'node:fs/promises';
import {URL} from 'node:url';

const {blue, dim} = chalk;
const {array, print} = utils;

const patches = {
    './node_modules/node-routeros/dist/connector/Receiver.js': {
        original: "throw new RosException_1.RosException('UNREGISTEREDTAG');",
        patch: "throw 'UNREGISTEREDTAG';",
    },
};

(async () => {
    try {
        await Promise.all(Object.entries(patches).map(async ([file, strings]) => {
            console.log(dim(`patch\n${blue(file)}`));

            const {pathname} = new URL(file, import.meta.url);
            let fileContent = await fs.readFile(pathname, {encoding: 'utf-8'});
            const errors = [];

            array.convert(strings).forEach(({original, patch}) => {
                fileContent = fileContent.replace(original, patch);

                if (!fileContent.includes(patch)) {
                    errors.push(`\nSomething goes wrong while patch ${file}:\nfrom: ${original}\nto: ${patch}`);
                }
            });

            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }

            await fs.writeFile(pathname, fileContent);
        }));
    } catch (err) {
        print.ex(err, {before: 'node_modules patch', exit: true});
    }
})();
