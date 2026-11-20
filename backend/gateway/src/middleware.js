// Request IDs, CORS and request logging.

const { randomUUID } = require('node:crypto');

const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

function requestId(req, res, next) {
    const incoming = req.get('X-Request-Id');
    req.id = incoming && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.set('X-Request-Id', req.id);
    next();
}

// CORS is configured only here: the gateway is the only service the browser talks to.
function cors(allowedOrigins) {
    const allowAny = allowedOrigins.includes('*');

    return function corsMiddleware(req, res, next) {
        const origin = req.get('Origin');

        if (origin && (allowAny || allowedOrigins.includes(origin))) {
            res.set({
                'Access-Control-Allow-Origin': allowAny ? '*' : origin,
                'Access-Control-Expose-Headers': 'X-Request-Id, Location, X-Total-Count',
            });
            if (!allowAny) res.vary('Origin');
        }

        if (req.method === 'OPTIONS' && req.get('Access-Control-Request-Method')) {
            res.set({
                'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-Id',
                'Access-Control-Max-Age': '600',
            });
            return res.status(204).end();
        }

        next();
    };
}

function requestLogger(req, res, next) {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        const service = res.locals.service ? ` -> ${res.locals.service}` : '';
        console.log(`[${req.id}] ${req.method} ${req.originalUrl}${service} ${res.statusCode} ${ms.toFixed(1)}ms`);
    });
    next();
}

module.exports = { requestId, cors, requestLogger };
