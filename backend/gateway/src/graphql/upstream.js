// Calls the REST services for the GraphQL resolvers, using the same URLs and timeouts as the proxy.

const { GraphQLError } = require('graphql');
const { GatewayError } = require('../errors');
const { validateToken } = require('../auth');

// extensions.status is the HTTP status the REST service answered with (the frontend reads it).
function fail(message, code, status, details) {
    return new GraphQLError(message, {
        extensions: { code, ...(status ? { status } : {}), ...(details ? { details } : {}) },
    });
}

const CODES = { 400: 'BAD_USER_INPUT', 401: 'UNAUTHENTICATED', 404: 'NOT_FOUND', 409: 'CONFLICT' };

// Returns the parsed JSON body, null for 204, or null for a 404 (so a missing item becomes `null` in GraphQL).
// With notFound: 'error' a 404 is a NOT_FOUND error instead (for mutations, whose result is not nullable).
async function upstream(ctx, serviceName, { method = 'GET', path, query = {}, body, headers = {}, notFound = 'null' }) {
    const service = ctx.config.services[serviceName];
    if (!service || !service.url) throw fail(`${serviceName} service is not configured`, 'UPSTREAM_UNAVAILABLE');

    const url = new URL(path, service.url);
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    const init = {
        method,
        headers: { Accept: 'application/json', 'X-Request-Id': ctx.requestId, ...headers },
        signal: AbortSignal.timeout(service.timeoutMs),
    };
    if (body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
    }

    let res;
    try {
        res = await fetch(url, init);
    } catch (err) {
        if (err.name === 'TimeoutError') {
            throw fail(`${serviceName} service did not respond within ${service.timeoutMs} ms`, 'UPSTREAM_TIMEOUT');
        }
        console.error(`[${ctx.requestId}] ${serviceName} service error: ${err.cause?.code || err.message}`);
        throw fail(`${serviceName} service is unavailable`, 'UPSTREAM_UNAVAILABLE');
    }

    if (res.status === 204) return null;
    if (res.ok) return res.json();
    if (res.status === 404 && notFound === 'null') return null;

    const data = await res.json().catch(() => null);
    const message = data?.error?.message || `${serviceName} service returned ${res.status}`;
    throw fail(message, CODES[res.status] || 'UPSTREAM_ERROR', res.status, data?.error?.details);
}

// Public data: no identity is sent.
const upstreamGet = (ctx, serviceName, path, query) => upstream(ctx, serviceName, { path, query });

// The user service owns the login token, so it gets the caller's Authorization header and checks it itself.
const asToken = (ctx, serviceName, request) =>
    upstream(ctx, serviceName, { ...request, headers: ctx.authorization ? { Authorization: ctx.authorization } : {} });

// Other services trust the gateway: it asks the user service who the caller is, then sends X-User-Id.
async function requireUserId(ctx) {
    let userId;
    try {
        userId = await ctx.userId();
    } catch (err) {
        if (err instanceof GatewayError) throw fail(err.message, err.code);
        throw err;
    }
    if (userId === null) throw fail('A valid bearer token is required', 'UNAUTHENTICATED', 401);
    return userId;
}

async function asUser(ctx, serviceName, request) {
    const userId = await requireUserId(ctx);
    return upstream(ctx, serviceName, { ...request, headers: { 'X-User-Id': String(userId) } });
}

// For a mutation: a missing trip, day or item is a NOT_FOUND error, not null.
const asUserMutation = (ctx, serviceName, request) => asUser(ctx, serviceName, { ...request, notFound: 'error' });

// Memoised per request: the user service is asked at most once, however many fields need a login.
function userIdLoader(config, authorization, requestId) {
    let pending;
    return () => (pending ??= validateToken(config, authorization, requestId));
}

module.exports = { upstream, upstreamGet, asToken, asUser, asUserMutation, requireUserId, userIdLoader, fail };
