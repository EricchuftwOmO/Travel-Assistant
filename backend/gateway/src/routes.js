// Order matters: the first matching rule wins. The trip budget path must come
// before the general /api/trips rule so it goes to the Budget Service.
const ROUTE_RULES = [
    { service: 'budget', pattern: /^\/api\/trips\/[^/]+\/budget\/?$/ },
    { service: 'trip', pattern: /^\/api\/trips(\/|$)/ },
    { service: 'trip', pattern: /^\/api\/(auth|users|places)(\/|$)/ },
    { service: 'search', pattern: /^\/api\/activities(\/|$)/ },
    { service: 'budget', pattern: /^\/api\/budget(\/|$)/ },
    { service: 'flight', pattern: /^\/api\/flights(\/|$)/ },
    { service: 'hotel', pattern: /^\/api\/hotels(\/|$)/ },
    { service: 'carRental', pattern: /^\/api\/car-rentals(\/|$)/ },
    { service: 'llm', pattern: /^\/api\/advice(\/|$)/ },
    { service: 'planner', pattern: /^\/api\/planner(\/|$)/ },
];

function buildRouteTable(services) {
    return ROUTE_RULES
        .filter((rule) => services[rule.service] && services[rule.service].url)
        .map((rule) => ({ ...rule, ...services[rule.service] }));
}

function matchRoute(routeTable, path) {
    return routeTable.find((route) => route.pattern.test(path)) || null;
}

module.exports = { buildRouteTable, matchRoute };
