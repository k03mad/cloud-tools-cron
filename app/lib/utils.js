/**
 * @param {string} isp
 * @returns {string}
 */
export const renameIsp = isp => {
    const replaces = [
        ['CLOUDFLARENET', 'Cloudflare'],
        ['Net By Net Holding LLC', 'NBN'],
        ['PJSC MegaFon', 'Megafon'],
        ['PVimpelCom', 'Beeline'],
        ['YANDEX LLC', 'Yandex'],
        ['Yandex Oy', 'Yandex'],
        ['Yandex.Cloud LLC', 'Yandex Cloud'],
    ];

    for (const [from, to] of replaces) {
        if (isp === from) {
            return to;
        }
    }

    return isp;
};
