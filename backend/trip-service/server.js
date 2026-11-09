// 讀取專案根目錄下的 .env 檔案，並把裡面定義的變數載入到 Node.js 的 process.env 環境變數中
// This must run before the other modules load, because they read process.env.
require('dotenv').config();

const db = require('./src/data/db');
const { ensureDatabase, ensureSchema } = require('./src/data/setup');
const app = require('./src/app');

const PORT = process.env.PORT || 3001;

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
