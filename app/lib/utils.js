/**
 * @param {string} isp
 * @returns {string}
 */
export const renameIsp = isp => {
    const replaces = [
        ['Net By Net Holding LLC', 'NBN'],
        ['PVimpelCom', 'Beeline'],
        ['CLOUDFLARENET', 'Cloudflare'],
    ];

    for (const [from, to] of replaces) {
        if (isp.trim() === from) {
            return to;
        }
    }

    return isp;
};
