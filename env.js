export default {
    cloud: {
        is: process.env.IS_CLOUD,
        domain: process.env.CLOUD_DOMAIN,
        grafana: {
            port: process.env.CLOUD_GRAFANA_PORT,
        },
        magnet: {
            port: process.env.CLOUD_MAGNET_PORT,
        },
    },
    lastfm: {
        users: process.env.LASTFM_USERS,
    },
    mikrotik: {
        host: process.env.MIKROTIK_HOST,
        port: {
            api: process.env.MIKROTIK_API_PORT,
        },
    },
    adg: {
        domain: process.env.ADG_DNS_DOMAIN,
    },
    fs: {
        home: process.env.HOME,
    },
};
