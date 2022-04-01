/* eslint-disable camelcase */
import {adg, influx} from '@k03mad/util';

/** */
export default async () => {
    const timeTo = Date.now();
    // 24h
    const timeFrom = timeTo - 86_400_000;

    const [
        account,
        countries,
        devices,
        dnsServers,
        filters,
        statsCompaniesFilter,
        statsDashboard,
        statsGeneral,
    ] = await Promise.all([
        'account',
        'stats/countries_filter',
        'devices',
        'dns_servers',
        'filters',
        'stats/companies_filter',
        `stats/dashboard?time_from_millis=${timeFrom}&time_to_millis=${timeTo}`,
        `stats/general?time_from_millis=${timeFrom}&time_to_millis=${timeTo}`,
    ].map(elem => adg.get(elem)));

    const deviceIdToName = Object.fromEntries(devices
        .map(({id, name}) => [id, name]));

    const enabledFilters = Object.fromEntries(dnsServers[0].settings.filter_lists_settings.filter_list
        .map(({enabled, filter_id}) => [filter_id, enabled]));

    const queriesValues = statsGeneral.time_stats.combined_stats.overall;
    const limitsValues = {...account.license.account_limits, ...account.license.request_limits};

    const countriesValues = Object.fromEntries(countries
        .filter(({country_code, queries}) => queries && country_code !== 'UNKNOWN_COUNTRY')
        .map(({country_code, queries}) => [country_code, queries]));

    const filtersValues = Object.fromEntries(filters
        .filter(({filter_id}) => enabledFilters[filter_id])
        .map(({filter_id, rules_count}) => [filter_id, rules_count]));

    const companiesValues = Object.fromEntries(statsCompaniesFilter
        .filter(({queries}) => queries)
        .map(({company, queries}) => [company.company_name, queries]));

    const categoriesValues = Object.fromEntries(statsGeneral.category_types_stats.stats
        .filter(({category_type}) => category_type !== 'OTHERS')
        .map(({category_type, queries}) => [category_type, queries]));

    const domainsValues = Object.fromEntries(statsGeneral.domains_stats.stats
        .map(({domain, value}) => [domain, value.queries]));

    const clientsValues = Object.fromEntries(statsDashboard.dns_servers_stats.values[0].devices_stats
        .map(({device_id, stats}) => [deviceIdToName[device_id], stats.queries]));

    await influx.write([
        {meas: 'adg-categories', values: categoriesValues},
        {meas: 'adg-clients', values: clientsValues},
        {meas: 'adg-companies', values: companiesValues},
        {meas: 'adg-countries', values: countriesValues},
        {meas: 'adg-domains', values: domainsValues},
        {meas: 'adg-filters', values: filtersValues},
        {meas: 'adg-limits', values: limitsValues},
        {meas: 'adg-queries', values: queriesValues},
    ]);
};
