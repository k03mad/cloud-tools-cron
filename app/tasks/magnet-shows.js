import {repo} from '@k03mad/util';

/** @returns {Promise<string>} */
export default () => repo.run('magnet-co-parser', 'parse --type=shows');
