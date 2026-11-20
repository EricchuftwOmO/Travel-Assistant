// Builds the Express app. server.js prepares the database and starts listening.

const fs = require('fs');
const path = require('path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const db = require('./data/db');
const accounts = require('./accounts');
const { graphqlHandler, typeDefs } = require('./graphql');
const { notFound, errorHandler } = require('./middleware/errorHandlers');

const specPath = path.join(__dirname, '..', 'openapi.yaml');
const apiSpec = YAML.parse(fs.readFileSync(specPath, 'utf8'));

const app = express();
app.disable('x-powered-by');

// CORS is handled by the API gateway, the only service the browser talks to.
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', service: 'user-service' });
  } catch {
    res.status(503).json({ status: 'down', service: 'user-service', reason: 'database unavailable' });
  }
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(apiSpec));
app.get('/openapi.yaml', (req, res) => res.type('application/yaml').sendFile(specPath));

// GraphQL: the main user API. The gateway forwards /api/graphql here.
app.post(['/graphql', '/api/graphql'], graphqlHandler);
app.get(['/graphql/schema', '/api/graphql/schema'], (req, res) => res.type('text/plain').send(typeDefs));

// REST login and registration, kept for simple clients and the Postman tests.
app.post('/api/auth/register', async (req, res) => {
  const result = await accounts.register(req.body);
  res.status(201).json(result);
});

app.post('/api/auth/login', async (req, res) => {
  res.status(200).json(await accounts.login(req.body));
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
