export default {
    cloud: {
        is: process.env.IS_CLOUD,
        domain: process.env.CLOUD_DOMAIN,
        grafana: {
            port: process.env.CLOUD_GRAFANA_PORT,
        },
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
