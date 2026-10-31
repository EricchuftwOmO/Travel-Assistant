// TCSS 559 Autumn 2026
// Travel Assistant - API Gateway
// Forwards a request to the owning service unchanged and streams the response back.
// A service that is down gives 502 UPSTREAM_UNAVAILABLE; one that doesn't answer
// in time gives 504 UPSTREAM_TIMEOUT.

const http = require('node:http');
const https = require('node:https');
const { GatewayError } = require('./errors');

// Hop-by-hop headers apply to a single connection and must not be forwarded
const HOP_BY_HOP = new Set([
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailer', 'transfer-encoding', 'upgrade',
]);

function copyHeaders(headers) {
    const copy = {};
    for (const [name, value] of Object.entries(headers)) {
        if (!HOP_BY_HOP.has(name.toLowerCase())) copy[name] = value;
    }
    return copy;
}

// Headers sent to the service: the client's headers plus tracing and forwarding info
function upstreamHeaders(req) {
    const headers = copyHeaders(req.headers);
    delete headers.host;   // set from the target URL
    headers['x-request-id'] = req.id;
    headers['x-forwarded-for'] = req.headers['x-forwarded-for']
        ? `${req.headers['x-forwarded-for']}, ${req.socket.remoteAddress}`
        : req.socket.remoteAddress;
    headers['x-forwarded-host'] = req.headers.host;
    headers['x-forwarded-proto'] = req.protocol;
    return headers;
}

function forward(req, res, next, route) {
    // The path and query string are forwarded unchanged
    const target = new URL(req.originalUrl, route.url);
    const client = target.protocol === 'https:' ? https : http;
    let finished = false;

    // Report a failure once: as a JSON error if nothing was sent yet, otherwise
    // by closing the connection (a half-sent response can't be fixed)
    function fail(error) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (res.headersSent) res.destroy();
        else next(error);
    }

    const upstreamReq = client.request(target, {
        method: req.method,
        headers: upstreamHeaders(req),
    }, (upstreamRes) => {
        clearTimeout(timer);
        res.writeHead(upstreamRes.statusCode, copyHeaders(upstreamRes.headers));
        upstreamRes.pipe(res);
        upstreamRes.on('end', () => { finished = true; });
        upstreamRes.on('error', () => fail());
    });

    // Timeout covers the time until the service starts its response
    const timer = setTimeout(() => {
        fail(new GatewayError(504, 'UPSTREAM_TIMEOUT',
            `${route.service} service did not respond within ${route.timeoutMs} ms`));
        upstreamReq.destroy();
    }, route.timeoutMs);

    upstreamReq.on('error', (err) => {
        if (finished) return;   // already handled (e.g. we aborted it after a timeout)
        console.error(`[${req.id}] ${route.service} service error: ${err.code || err.message}`);
        fail(new GatewayError(502, 'UPSTREAM_UNAVAILABLE', `${route.service} service is unavailable`));
    });

    // If the client goes away, stop waiting for the service
    res.on('close', () => {
        clearTimeout(timer);
        if (!res.writableFinished) upstreamReq.destroy();
    });

    // Stream the request body (if any) to the service without parsing it
    req.pipe(upstreamReq);
}

module.exports = { forward };
