// TCSS 559 Autumn 2026
// Travel Assistant - API Gateway
// Forwards a request to the owning service unchanged, using http-proxy-middleware.
// A service that is down gives 502 UPSTREAM_UNAVAILABLE; one that doesn't answer
// in time gives 504 UPSTREAM_TIMEOUT.

const http = require('node:http');
const https = require('node:https');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { sendError } = require('./errors');

// Create the proxy for one route (called once at startup, not per request)
function createProxy(route) {
    // Reuse connections to the service. Without an agent the library
    // sends "Connection: close" and opens a new connection every request.
    const isHttps = new URL(route.url).protocol === 'https:';
    const agent = isHttps ? new https.Agent({ keepAlive: true }) : new http.Agent({ keepAlive: true });

    return createProxyMiddleware({
        target: route.url,
        agent,
        changeOrigin: true,          // Host header = the service, not the gateway
        xfwd: true,                  // add X-Forwarded-For / -Host / -Proto / -Port
        proxyTimeout: route.timeoutMs,

        on: {
            proxyReq(proxyReq, req) {
                proxyReq.setHeader('X-Request-Id', req.id);
                // The library reports a timeout as a generic ECONNRESET,
                // so remember that the timeout happened
                proxyReq.on('timeout', () => { req.upstreamTimedOut = true; });
            },

            error(err, req, res) {
                // A half-sent response can't be turned into an error; close it
                if (res.headersSent) return res.destroy();

                if (req.upstreamTimedOut) {
                    return sendError(res, 504, 'UPSTREAM_TIMEOUT',
                        `${route.service} service did not respond within ${route.timeoutMs} ms`);
                }
                console.error(`[${req.id}] ${route.service} service error: ${err.code || err.message}`);
                sendError(res, 502, 'UPSTREAM_UNAVAILABLE', `${route.service} service is unavailable`);
            },
        },
    });
}

module.exports = { createProxy };
