// Load .env first: other modules read process.env when they load.
require('dotenv').config();

const db = require('./src/data/db');
const { ensureDatabase, ensureSchema } = require('./src/data/setup');
const app = require('./src/app');

const PORT = process.env.PORT || 3009;

// On failure exit so Docker Compose restarts the service (e.g. while PostgreSQL is starting).
const start = async () => {
  await ensureDatabase();
  if (await ensureSchema(db)) console.log('Loaded the sample users');
  const server = app.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`user-service running on port ${PORT}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

start().catch((err) => {
  console.error('user-service failed to start:', err.message);
  process.exit(1);
});
