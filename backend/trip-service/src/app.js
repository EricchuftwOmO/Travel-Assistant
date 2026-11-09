// Builds the Express app: health check, API docs, routes, and error handling.
// server.js prepares the database and starts listening.

const fs = require('fs');
const path = require('path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const db = require('./data/db');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandlers');

const specPath = path.join(__dirname, '..', 'openapi.yaml');
const apiSpec = YAML.parse(fs.readFileSync(specPath, 'utf8'));

const app = express();
app.disable('x-powered-by');

// Middleware
// CORS is handled by the API gateway, the only service the browser talks to.
app.use(express.json());

// Liveness and database check (the gateway's /api/health calls this)
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', service: 'trip-service' });
  } catch {
    res.status(503).json({ status: 'down', service: 'trip-service', reason: 'database unavailable' });
  }
});

// API documentation: Swagger UI at /docs, raw file at /openapi.yaml
app.use('/docs', swaggerUi.serve, swaggerUi.setup(apiSpec));
app.get('/openapi.yaml', (req, res) => res.type('application/yaml').sendFile(specPath));

// Routes
app.use('/api', routes);

// Error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
