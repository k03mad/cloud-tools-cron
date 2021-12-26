import {influx, tinkoff} from '@k03mad/util';
import asTable from 'as-table';

const tgPreviousYield = {};

/***/
export default async () => {
    const instrumentTypes = new Set(['Stock', 'Etf']);
    const tickerUsdToRub = 'USD000UTSTOM';

    const alertChangeYield = {
        Stock: {
            USD: 30,
            RUB: 500,
        },
        Etf: {
            USD: 30,
            RUB: 500,
        },
    };

    const tickers = {
        'yield': {},
        'price-one': {},
        'price-total': {},
    };

    const tgMessage = [];

    const {portfolio} = await tinkoff.portfolio();

    const usdToRubPrice = portfolio
        .find(elem => elem.ticker === tickerUsdToRub)
        .averagePositionPrice
        .value;

    portfolio.forEach(({
        averagePositionPrice, balance, expectedYield,
        instrumentType, ticker,
    }) => {
        if (instrumentTypes.has(instrumentType)) {

            // INFLUX

            const currentYieldVal = expectedYield.value;
            const currentYieldCur = expectedYield.currency;

            const currentPriceTotal = (balance * averagePositionPrice.value) + currentYieldVal;
            const currentPriceOne = currentPriceTotal / balance;

            const isCurrencyUsd = currentYieldCur === 'USD';

            const tickerYield = isCurrencyUsd ? currentYieldVal * usdToRubPrice : currentYieldVal;
            const tickerPriceOne = isCurrencyUsd ? currentPriceOne * usdToRubPrice : currentPriceOne;
            const tickerPriceTotal = isCurrencyUsd ? currentPriceTotal * usdToRubPrice : currentPriceTotal;

            if (tickerYield) {
                tickers.yield[ticker] = tickerYield;
            }

            if (tickerPriceOne) {
                tickers['price-one'][ticker] = tickerPriceOne;
            }

            if (tickerPriceTotal) {
                tickers['price-total'][ticker] = tickerPriceTotal;
            }

            // TELEGRAM

            if (!tgPreviousYield[ticker]) {
                tgPreviousYield[ticker] = currentYieldVal;
            }

            const previousYieldVal = tgPreviousYield[ticker];
            const alertThreshold = alertChangeYield[ticker] || alertChangeYield[instrumentType][currentYieldCur];

            if (Math.abs(previousYieldVal - currentYieldVal) >= alertThreshold) {
                const arrow = previousYieldVal > currentYieldVal ? '▼' : '▲';

                tgMessage.push([
                    `${arrow} ${ticker}`,
                    isCurrencyUsd ? currentYieldVal : Math.round(currentYieldVal),
                    isCurrencyUsd ? previousYieldVal : Math.round(previousYieldVal),
                    `${
                        currentYieldCur.replace('RUB', 'Р').replace('USD', '$')
                    } ${
                        isCurrencyUsd ? Number(currentPriceOne.toFixed(2)) : Math.round(currentPriceOne)
                    }`,
                ]);

                tgPreviousYield[ticker] = currentYieldVal;
            }
        }
    });

    if (tgMessage.length > 0) {
        const table = asTable(tgMessage.sort((a, b) => b[1] - a[1]));
        const text = `\`\`\`\n${table}\n\`\`\``;

        await tinkoff.notify({text});
    }

    const data = [
        ...Object
            .entries(tickers)
            .map(([meas, values]) => ({meas: `tinkoff-${meas}`, values})),
    ];

    await influx.write(data);
};
