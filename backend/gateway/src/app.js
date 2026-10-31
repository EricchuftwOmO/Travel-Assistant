// TCSS 559 Autumn 2026
// Travel Assistant - API Gateway
// Builds the Express app: the single entry point for the frontend

const express = require('express');
const { requestId, cors, requestLogger } = require('./middleware');
const { buildRouteTable, matchRoute } = require('./routes');
const { createProxy } = require('./proxy');
const { healthHandler } = require('./health');
const { notFound, errorHandler } = require('./errors');

function createApp(config) {
    const app = express();
    const routeTable = buildRouteTable(config.services);

    app.disable('x-powered-by');

    app.use(requestId);
    if (config.logRequests) app.use(requestLogger);
    app.use(cors(config.corsOrigins));

    // The gateway's own liveness check (used by Docker)
    app.get('/health', (req, res) => res.json({ status: 'ok' }));

    // Combined health check of all services
    app.get('/api/health', healthHandler(config));

    // Forward /api/* to the owning service. No body parser: bodies are streamed as-is.
    // Not mounted with app.use('/api', ...), because that would strip "/api" from
    // the path and the services expect the full path.
    const proxies = new Map(routeTable.map((route) => [route, createProxy(route)]));
    app.use((req, res, next) => {
        const route = matchRoute(routeTable, req.path);
        if (!route) return next();
        res.locals.service = route.service;
        proxies.get(route)(req, res, next);
    });

    // Unknown endpoints return 404, and all errors return JSON (these must come last)
    app.use(notFound);
    app.use(errorHandler);

    return app;
}

module.exports = { createApp };
