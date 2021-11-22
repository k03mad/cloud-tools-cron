'use strict';

module.exports = {
    cloud: {
        is: process.env.IS_CLOUD,
    },
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
