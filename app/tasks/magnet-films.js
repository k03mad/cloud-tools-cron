import utils from '@k03mad/utils';

const {repo} = utils;

/** @returns {Promise<string>} */
export default () => repo.run('magnet-co-parser', 'parse --type=films');
