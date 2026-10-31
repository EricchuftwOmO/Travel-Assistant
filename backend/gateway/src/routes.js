// TCSS 559 Autumn 2026
// Travel Assistant - API Gateway
// Route table: which service owns each /api path

// Order matters: the first matching rule wins. The trip budget path must come
// before the general /api/trips rule so it goes to the Budget Service.
const ROUTE_RULES = [
    { service: 'budget', pattern: /^\/api\/trips\/[^/]+\/budget\/?$/ },  // #10
    { service: 'trip', pattern: /^\/api\/trips(\/|$)/ },                  // #1-#8
    { service: 'search', pattern: /^\/api\/activities(\/|$)/ },           // #9
    { service: 'budget', pattern: /^\/api\/budget(\/|$)/ },               // #11
    { service: 'planner', pattern: /^\/api\/planner(\/|$)/ },             // #12-#13 (stretch)
];

// Keep only the rules whose service has a URL configured
function buildRouteTable(services) {
    return ROUTE_RULES
        .filter((rule) => services[rule.service] && services[rule.service].url)
        .map((rule) => ({ ...rule, ...services[rule.service] }));
}

// Find the route for a request path, or null if no service owns it
function matchRoute(routeTable, path) {
    return routeTable.find((route) => route.pattern.test(path)) || null;
}

module.exports = { buildRouteTable, matchRoute };
