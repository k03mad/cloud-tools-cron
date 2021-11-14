'use strict';

module.exports = {
    lastfm: {
        users: process.env.LASTFM_USERS,
    },
    mikrotik: {
        domain: process.env.MIKROTIK_DOMAIN,
    },
    influx: {
        request: process.env.INFLUX_STORE_REQUEST_STATS,
    },
};
