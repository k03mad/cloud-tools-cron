import {array} from '@k03mad/util';

/**
 * @param {string} isp
 * @returns {string}
 */
export const renameIsp = isp => {
    const replaces = [
        [/.*\scomcor$/i, 'Akado'],
        [/^cloudflarenet$/i, 'Cloudflare'],
        [/^megafon$/i, 'Megafon'],
        [/^net by net holding llc$/i, 'NBN'],
        [/^pvimpelcom$/i, 'Beeline'],
        [/^yandex$/i, 'Yandex'],

        /\sllc/i,
        /\sltd\.?/i,
        /\soy$/i,
        /p?jsc\s/i,
    ];

    replaces.forEach(elem => {
        const [from, to = ''] = array.convert(elem);
        isp = isp.replace(from, to);
    });

    return isp.trim();
};
