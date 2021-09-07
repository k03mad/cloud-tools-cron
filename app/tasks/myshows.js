'use strict';

const {myshows, influx} = require('@k03mad/utils');

/** @returns {Promise} */
module.exports = async () => {
    const [episodes, {stats}] = await Promise.all([
        myshows.watch({onlyAired: true}),
        myshows.get({method: 'profile.Get'}),
    ]);

    const episodesToWatch = Object.fromEntries(
        episodes.map(episode => [
            episode.show.titleOriginal,
            episode.totalEpisodes - episode.watchedEpisodes,
        ]),
    );

    await influx.write([
        {meas: 'myshows-episodes', values: episodesToWatch},
        {meas: 'myshows-stats', values: stats},
    ]);
};
