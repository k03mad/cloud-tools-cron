import {request, tinkoff} from '@k03mad/util';

/***/
export default async () => {
    const {body} = await request.got('https://api.tinkoff.ru/geo/withdraw/clusters', {
        method: 'POST',
        json: {
            bounds: {
                bottomLeft: {lat: 55.881_213_431_700_66, lng: 37.690_449_633_723_375},
                topRight: {lat: 55.958_232_751_679_084, lng: 37.875_328_936_701_884},
            },
            filters: {
                banks: ['tcs'],
                showUnavailable: true,
                currencies: ['USD'],
                amounts: [{currency: 'USD', amount: 1000}],
            },
            zoom: 13,
        },
    });

    const atm = body.payload.clusters
        .flatMap(cluster => cluster.points.map(point => {
            if (point.available) {
                return `${point.address} ($${point.limits.find(elem => elem.currency === 'USD').amount})`;
            }

            return null;
        }))
        .map((elem, i) => `${i + 1}. ${elem}`)
        .join('\n');

    if (atm) {
        const text = `\`\`\`\n${atm}\n\`\`\``;
        await tinkoff.notify({text});
    }
};
