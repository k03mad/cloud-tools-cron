import {array, request, tinkoff} from '@k03mad/util';
import moment from 'moment';

const getYandexMapSearchUrl = query => `https://yandex.ru/maps/?mode=search&text=${query}`;

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
                showUnavailable: false,
                currencies: ['USD'],
                amounts: [{currency: 'USD', amount: 1000}],
            },
            zoom: 13,
        },
    });

    const atm = body.payload.clusters
        .flatMap(cluster => cluster.points
            .map(point => {
                const cash = Number(`${point.limits.find(({currency}) => currency === 'USD').amount}`);
                const address = `${point.address.replace(/\s{2,}/g, '')}`;

                const {closeTime, openTime} = point.workPeriods[moment().format('d')];

                const workTime = `${array.insert([...openTime], 2, ':').join('')}`
                               + ` — ${array.insert([...closeTime], 2, ':').join('')}`;

                const link = getYandexMapSearchUrl(`${point.location.lat},${point.location.lng}`);

                return {cash, workTime, link, address};
            }),
        )
        .map((elem, i, arr) => `\`\`\`\n${arr.length > 1 ? `${i + 1}. ` : ''}`
            + `$${elem.cash} :: ${elem.workTime}\n\`\`\``
            + `[${elem.address}](${elem.link})`)
        .join('\n\n');

    if (atm) {
        await tinkoff.notify({text: atm});
    }
};
