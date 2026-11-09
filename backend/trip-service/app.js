// 讀取專案根目錄下的 .env 檔案，並把裡面定義的變數載入到 Node.js 的 process.env 環境變數中
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const db = require('./data/db');
const { ensureDatabase, ensureSchema } = require('./data/setup');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandlers');

const app = express();
const PORT = process.env.PORT || 3001;
const specPath = path.join(__dirname, 'openapi.yaml');
const apiSpec = YAML.parse(fs.readFileSync(specPath, 'utf8'));

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

// Prepare the database, then listen. On failure, exit with a clear message;
// Docker Compose restarts the service (for example while PostgreSQL is starting).
const start = async () => {
  await ensureDatabase();
  if (await ensureSchema(db)) console.log('Created the tables and loaded the sample data');
  const server = app.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`trip-service running on port ${PORT}`);
  });
  // docker stop sends SIGTERM: finish open requests, then exit
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

start().catch((err) => {
  console.error('trip-service failed to start:', err.message);
  process.exit(1);
});
