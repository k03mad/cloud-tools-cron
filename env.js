export default {
    cloud: {
        is: process.env.IS_CLOUD,
        domain: process.env.CLOUD_DOMAIN,
        magnet: {
            port: process.env.CLOUD_MAGNET_PORT,
        },
        grafana: {
            port: process.env.CLOUD_GRAFANA_PORT,
        },
    },
    lastfm: {
        users: process.env.LASTFM_USERS,
    },
    mikrotik: {
        domain: process.env.MIKROTIK_DOMAIN,
        ovpn: {
            port: process.env.MIKROTIK_OVPN_PORT,
        },
    },
    nextdns: {
        domain: process.env.NEXT_DNS_DOMAIN,
    },
    influx: {
        request: process.env.INFLUX_STORE_REQUEST_STATS,
    },
    fs: {
        home: process.env.HOME,
    },
};
