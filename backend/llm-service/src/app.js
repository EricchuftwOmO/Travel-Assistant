// Express app. The gateway forwards /api paths unchanged, so routes live under resource.path.

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const { createCrudRouter } = require('./crud');

function createApp({ pool, cache, resource, hooks, serviceName, extend }) {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json());

    app.get('/health', async (req, res) => {
        try {
            await pool.query('SELECT 1');
            res.json({ status: 'ok', service: serviceName, cache: cache.enabled ? 'redis' : 'off' });
        } catch {
            res.status(503).json({ status: 'down', service: serviceName, reason: 'database unavailable' });
        }
    });

    const specPath = path.join(__dirname, '..', 'openapi.yaml');
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(YAML.parse(fs.readFileSync(specPath, 'utf8'))));
    app.get('/openapi.yaml', (req, res) => res.type('application/yaml').sendFile(specPath));

    // extra routes (e.g. POST /api/advice/recommendations) go first so they win over /:id
    if (extend) app.use(resource.path, extend);
    app.use(resource.path, createCrudRouter(resource, pool, cache, hooks));

    app.use((req, res) => {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
    });

    app.use((err, req, res, next) => {
        if (res.headersSent) return next(err);
        if (err.type === 'entity.parse.failed') {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Request body is not valid JSON' } });
        }
        if (err.status && err.code) {
            return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
        }
        console.error(err);
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
    });

    return app;
}

module.exports = { createApp };
