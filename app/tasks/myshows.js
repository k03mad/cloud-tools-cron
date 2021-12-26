import {influx, myshows} from '@k03mad/util';

/** @returns {Promise} */
export default async () => {
    await myshows.auth();

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
