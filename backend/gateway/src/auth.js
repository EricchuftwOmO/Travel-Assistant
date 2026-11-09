// TCSS 559 Autumn 2026
// Travel Assistant - API Gateway
// Login check: the gateway verifies the JWT (HS256, signed by the trip service
// with the shared JWT_SECRET) before a request reaches any service.

const { createHmac, timingSafeEqual } = require('node:crypto');
const { sendError } = require('./errors');

// Reachable without a token. Everything else under /api needs one.
const PUBLIC_RULES = [
    { methods: ['POST'], pattern: /^\/api\/auth\/(register|login)\/?$/ },
    { methods: ['GET', 'HEAD'], pattern: /^\/api\/(flights|hotels|car-rentals|activities)(\/|$)/ },
];

function isPublic(method, path) {
    return PUBLIC_RULES.some((r) => r.methods.includes(method) && r.pattern.test(path));
}

const b64 = (s) => Buffer.from(s, 'base64url');

// Returns the token payload, or null if it is malformed, badly signed or expired
function verifyJwt(token, secret, now = Date.now()) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        const header = JSON.parse(b64(parts[0]).toString());
        if (header.alg !== 'HS256') return null;
        const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
        const actual = b64(parts[2]);
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
        const payload = JSON.parse(b64(parts[1]).toString());
        if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) return null;
        return payload;
    } catch {
        return null;
    }
}

function requireLogin(secret) {
    return function authMiddleware(req, res, next) {
        // Never trust an identity header sent by a client
        req.headers['x-user-id'] = undefined;
        delete req.headers['x-user-id'];

        if (req.method === 'OPTIONS' || !req.path.startsWith('/api/') || isPublic(req.method, req.path)) {
            return next();
        }
        const [scheme, token] = (req.get('Authorization') || '').split(' ');
        const payload = scheme === 'Bearer' && token ? verifyJwt(token, secret) : null;
        if (!payload) {
            res.set('WWW-Authenticate', 'Bearer');
            return sendError(res, 401, 'UNAUTHORIZED', 'A valid bearer token is required');
        }
        req.headers['x-user-id'] = String(payload.userId);
        next();
    };
}

module.exports = { requireLogin, verifyJwt, isPublic };
