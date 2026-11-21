// The gateway does not read tokens. It asks the user service (the only service that knows the JWT secret)
// whether the bearer token is valid, and passes the answer on to the other services as X-User-Id.

const { GatewayError, sendError } = require('./errors');

// Reachable without a token. The user service enforces login on its own /api/users/* routes.
const PUBLIC_RULES = [
    { methods: ['POST'], pattern: /^\/api\/auth\/(register|login|google)\/?$/ },
    { methods: ['GET', 'HEAD'], pattern: /^\/api\/(flights|hotels|car-rentals|activities)(\/|$)/ },
];

// Paths the user service answers itself, so the gateway does not check them first.
const USER_SERVICE_PATHS = /^\/api\/(auth|users)(\/|$)/;

function isPublic(method, path) {
    return PUBLIC_RULES.some((r) => r.methods.includes(method) && r.pattern.test(path));
}

// Returns the user id for a valid token, or null for a missing, bad or expired one.
// Throws a GatewayError when the user service cannot be asked (502 / 504).
async function validateToken(config, authorization, requestId) {
    if (!/^Bearer\s+\S+$/.test(authorization || '')) return null;
    const user = config.services.user;
    if (!user || !user.url) throw new GatewayError(502, 'UPSTREAM_UNAVAILABLE', 'user service is not configured');

    let res;
    try {
        res = await fetch(new URL('/api/auth/validate', user.url), {
            headers: { Authorization: authorization, 'X-Request-Id': requestId, Accept: 'application/json' },
            signal: AbortSignal.timeout(user.timeoutMs),
        });
    } catch (err) {
        if (err.name === 'TimeoutError') {
            throw new GatewayError(504, 'UPSTREAM_TIMEOUT', `user service did not respond within ${user.timeoutMs} ms`);
        }
        console.error(`[${requestId}] user service error: ${err.cause?.code || err.message}`);
        throw new GatewayError(502, 'UPSTREAM_UNAVAILABLE', 'user service is unavailable');
    }

    if (res.status === 401) return null;
    if (!res.ok) throw new GatewayError(502, 'UPSTREAM_UNAVAILABLE', `user service returned ${res.status}`);
    const { userId } = await res.json().catch(() => ({}));
    return Number.isInteger(userId) ? userId : null;
}

function requireLogin(config) {
    return async function authMiddleware(req, res, next) {
        // Never trust an identity header sent by a client
        delete req.headers['x-user-id'];

        if (req.method === 'OPTIONS' || !req.path.startsWith('/api/')
            || USER_SERVICE_PATHS.test(req.path) || isPublic(req.method, req.path)) {
            return next();
        }
        try {
            const userId = await validateToken(config, req.get('Authorization'), req.id);
            if (userId === null) {
                res.set('WWW-Authenticate', 'Bearer');
                return sendError(res, 401, 'UNAUTHORIZED', 'A valid bearer token is required');
            }
            req.headers['x-user-id'] = String(userId);
            next();
        } catch (err) {
            next(err);
        }
    };
}

module.exports = { requireLogin, validateToken, isPublic };
