import {influx, lastfm} from '@k03mad/util';

import env from '../../env.js';

/** */
export default async () => {
    const recentTracksGetSeconds = 3600;

    const countWithBugAbove = {
        artists: 150,
        tracks: 100,
        recent: 100,
    };

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

        const playCount = Number(getinfo.user.playcount);

        if (playCount > 0) {
            playcount[user] = playCount;
        }

        const artistCount = Number(getartists.artists['@attr'].total);

        if (artistCount > 0) {
            artistscount[user] = artistCount;
        }

        recenttracks[user] = Number(getrecenttracks.recenttracks['@attr'].total);

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

    const topTracks = Object.entries(toptracks).map(([name, tracks]) => ({meas: `lastfm-toptracks-${name}`, values: tracks}));
    const topArtists = Object.entries(topartists).map(([name, artists]) => ({meas: `lastfm-topartists-${name}`, values: artists}));

    // lastfm api bug: incorrect data with very large numbers
    if (
        !Object.values(recenttracks).some(elem => elem > countWithBugAbove.recent)
        && !Object.values(topTracks).flatMap(elem => Object.values(elem.values)).some(elem => elem > countWithBugAbove.tracks)
        && !Object.values(topArtists).flatMap(elem => Object.values(elem.values)).some(elem => elem > countWithBugAbove.artists)
    ) {

        await influx.write([
            {meas: 'lastfm-artists-count', values: artistscount},
            {meas: 'lastfm-playcount-total', values: playcount},
            {meas: 'lastfm-playcount-hour', values: recenttracks},
            ...topTracks,
            ...topArtists,
        ]);

    }
};
