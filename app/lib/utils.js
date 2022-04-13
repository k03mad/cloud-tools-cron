/**
 * @param {string} isp
 * @returns {string}
 */
export const renameIsp = isp => {
    const replaces = [
        ['Net By Net Holding LLC', 'NBN'],
        [/T2 Mobile|Tele2 Russia/, 'Tele2'],
        ['YANDEX', 'Yandex'],
        ['CLOUDFLARENET', 'Cloudflare'],

        ['AO'],
        ['Bank'],
        ['Company'],
        ['Liability'],
        ['Limited'],
        ['LLC'],
        ['OOO'],

        [/incorporated/i],
        [/ltd.?/i],
        [/Oy$/],
        [/P?JSC/],
    ];

    replaces.forEach(([from, to = '']) => {
        isp = isp.replace(from, to);
    });

    return isp.trim();
};
