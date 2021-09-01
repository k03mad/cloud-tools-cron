'use strict';

const env = require('../../env');
const {influx, lastfm} = require('@k03mad/utils');

/***/
module.exports = async () => {
    const recentTracksGetSeconds = 3600;

    const artistscount = {};
    const playcount = {};
    const toptracks = {};
    const topartists = {};
    const recenttracks = {};

    await Promise.all(env.lastfm.users.split(',').map(async user => {
        const [
            getartists,
            getinfo,
            getrecenttracks,
            gettoptracks,
            gettopartists,
        ] = await Promise.all([
            lastfm.get({method: 'library.getartists', user}),
            lastfm.get({method: 'user.getinfo', user}),

            lastfm.get({
                method: 'user.getrecenttracks',
                from: Math.round(Date.now() / 1000) - recentTracksGetSeconds,
                user,
            }),

            lastfm.get({
                method: 'user.gettoptracks',
                period: '1month',
                limit: 20,
                user,
            }),

            lastfm.get({
                method: 'user.gettopartists',
                period: '1month',
                limit: 20,
                user,
            }),
        ]);

        artistscount[user] = Number(getartists.artists['@attr'].total);
        playcount[user] = Number(getinfo.user.playcount);
        recenttracks[user] = getrecenttracks.recenttracks.track.length;

        gettoptracks.toptracks.track.forEach(track => {
            const key = `${track.artist.name} - ${track.name}`;
            const count = Number(track.playcount);

            if (toptracks[user]) {
                toptracks[user][key] = count;
            } else {
                toptracks[user] = {[key]: count};
            }
        });

        gettopartists.topartists.artist.forEach(artist => {
            const key = artist.name;
            const count = Number(artist.playcount);

            if (topartists[user]) {
                topartists[user][key] = count;
            } else {
                topartists[user] = {[key]: count};
            }
        });
    }));

    await influx.write([
        {meas: 'lastfm-artists-count', values: artistscount},
        {meas: 'lastfm-playcount-total', values: playcount},
        {meas: 'lastfm-playcount-hour', values: recenttracks},
        ...Object.entries(toptracks).map(([name, tracks]) => ({meas: `lastfm-toptracks-${name}`, values: tracks})),
        ...Object.entries(topartists).map(([name, artists]) => ({meas: `lastfm-topartists-${name}`, values: artists})),
    ]);
};
