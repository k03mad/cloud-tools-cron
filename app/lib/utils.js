import path from 'node:path';

/**
 * @param {string} folder
 * @param {string} file
 * @returns {object}
 */
export const getFileUrl = (folder, file) => new URL(
    `../../${folder}/${file}`,
    import.meta.url,
).pathname;

/**
 * @param {string} folder
 * @param {string} file
 * @returns {object}
 */
export const getCacheFileAbsPath = (folder, file) => {
    const pathname = getFileUrl(folder, file);
    return {pathname, dirname: path.dirname(pathname)};
};
