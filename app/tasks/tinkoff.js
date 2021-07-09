'use strict';

const asTable = require('as-table');
const {tinkoff} = require('@k03mad/utils');

const tgPreviousYield = {};

/***/
module.exports = async () => {
    const alertChangeYield = {
        Stock: {
            USD: 10,
            RUB: 100,
        },
        Etf: {
            USD: 10,
            RUB: 1000,
        },
    };

    const instrumentTypes = new Set(['Stock', 'Etf']);

    // const tickers = {};
    const tgMessage = [];

    const {portfolio} = await tinkoff.portfolio();

    portfolio.forEach(({
        instrumentType, ticker, lots,
        expectedYield, averagePositionPrice,
    }) => {
        if (instrumentTypes.has(instrumentType)) {
            const currentYield = expectedYield.value;
            const currentYieldCur = expectedYield.currency;
            const currentValue = (lots * averagePositionPrice.value) + currentYield;
            const currentPrice = currentValue / lots;
            const isCurrencyRub = currentYieldCur === 'RUB';

            if (!tgPreviousYield[ticker]) {
                tgPreviousYield[ticker] = currentYield;
            }

            const previousYield = tgPreviousYield[ticker];

            if (Math.abs(previousYield - currentYield) >= alertChangeYield[instrumentType][currentYieldCur]) {
                const arrow = previousYield > currentYield ? '▼' : '▲';
                tgMessage.push([
                    `${arrow} ${ticker}`,
                    isCurrencyRub ? Math.round(currentYield) : currentYield,
                    isCurrencyRub ? Math.round(previousYield) : previousYield,
                    `${
                        currentYieldCur.replace('RUB', 'Р').replace('USD', '$')
                    } ${
                        isCurrencyRub ? Math.round(currentPrice) : Number(currentPrice.toFixed(2))
                    }`,
                ]);
                tgPreviousYield[ticker] = currentYield;
            }
        }
    });

    if (tgMessage.length > 0) {
        const table = asTable(tgMessage.sort((a, b) => b[1] - a[1]));
        const text = `\`\`\`\n${table}\n\`\`\``;

        await tinkoff.notify({text});
    }
};
