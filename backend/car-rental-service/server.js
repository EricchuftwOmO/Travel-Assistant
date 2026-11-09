// TCSS 559 Autumn 2026
// Travel Assistant - car-rental-service
// Starts the service: connect to PostgreSQL, prepare the table, then listen.

const { connect } = require('./src/db');
const { createCache } = require('./src/cache');
const { initTable } = require('./src/crud');
const { createApp } = require('./src/app');
const resource = require('./src/resource');
const SERVICE_NAME = 'car-rental-service';
const PORT = Number(process.env.PORT) || 3006;

async function main() {
    const pool = await connect(process.env.DB_NAME || resource.dbName);
    await initTable(pool, resource);
    const cache = createCache({
        url: process.env.REDIS_URL,
        prefix: resource.table,
        ttlSeconds: Number(process.env.CACHE_TTL_SECONDS) || 60,
    });

    const app = createApp({ pool, cache, resource, hooks: undefined, serviceName: SERVICE_NAME });
    const server = app.listen(PORT, () => console.log(`${SERVICE_NAME} listening on port ${PORT}`));

    // docker stop sends SIGTERM: finish open requests, then close connections
    const shutdown = () => server.close(async () => { await cache.close(); await pool.end(); process.exit(0); });
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

main().catch((err) => {
    console.error(`${SERVICE_NAME} failed to start:`, err.message);
    process.exit(1);   // Compose restarts it (e.g. while PostgreSQL is still starting)
});
