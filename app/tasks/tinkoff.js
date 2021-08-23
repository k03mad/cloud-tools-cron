'use strict';

const asTable = require('as-table');
const {influx, tinkoff} = require('@k03mad/utils');

const tgPreviousYield = {};

/***/
module.exports = async () => {
    const instrumentTypes = new Set(['Stock', 'Etf']);
    const tickerUsdToRub = 'USD000UTSTOM';

    const alertChangeYield = {
        Stock: {
            USD: 50,
            RUB: 100,
        },
        Etf: {
            USD: 10,
            RUB: 1000,
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
        instrumentType, ticker, lots,
        expectedYield, averagePositionPrice,
    }) => {
        if (instrumentTypes.has(instrumentType)) {

            // INFLUX

            const currentYieldVal = expectedYield.value;
            const currentYieldCur = expectedYield.currency;

            const currentPriceTotal = (lots * averagePositionPrice.value) + currentYieldVal;
            const currentPriceOne = currentPriceTotal / lots;

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

            if (Math.abs(previousYieldVal - currentYieldVal) >= alertChangeYield[instrumentType][currentYieldCur]) {
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
