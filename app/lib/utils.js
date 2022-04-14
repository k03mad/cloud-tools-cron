/**
 * @param {string} isp
 * @returns {string}
 */
export const renameIsp = isp => {
    const ispClone = isp;

    const replaces = [
        ['Net By Net Holding LLC', 'NBN'],

        [/T2 Mobile|Tele2 Russia/, 'Tele2'],
        ['PVimpelCom', 'Beeline'],

        ['YANDEX', 'Yandex'],
        ['CLOUDFLARENET', 'Cloudflare'],

        'AO',
        'Bank',
        'Communications',
        'Company',
        'GmbH',
        'incorporated',
        'Liability',
        'Limited',
        'LLC',
        'ltd.',
        'OOO',

        /Oy$/,
        /P?JSC/,
    ];

    replaces.forEach(elem => {
        let from = elem;
        let to = '';

        if (Array.isArray(elem)) {
            [from, to] = elem;
        }

        isp = isp.replace(from, to);
    });

    return isp.trim() || ispClone;
};
