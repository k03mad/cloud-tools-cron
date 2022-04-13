/**
 * @param {string} isp
 * @returns {string}
 */
export const renameIsp = isp => {
    const replaces = [
        ['Net By Net Holding LLC', 'NBN'],
        ['T2 Mobile', 'Tele2'],
        ['Tele2 Russia', 'Tele2'],
        ['YANDEX', 'Yandex'],
        ['CLOUDFLARENET', 'Cloudflare'],

        ['LLC'],
        ['AO'],
        ['OOO'],
        ['JSC'],
        ['ltd'],
        ['Ltd.'],
        ['Bank'],
        ['Limited'],
        ['Liability'],
        ['Company'],
        ['incorporated'],
        ['Oy'],
    ];

    replaces.forEach(([from, to = '']) => {
        isp = isp.replace(from, to);
    });

    return isp.trim();
};
