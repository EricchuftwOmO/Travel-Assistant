// Starts the service: connect to PostgreSQL, prepare the table, then listen.

const { connect } = require('./src/db');
const { createCache } = require('./src/cache');
const { initTable } = require('./src/crud');
const { createApp } = require('./src/app');
const { createLiveSearch } = require('./src/liveSearch');
const resource = require('./src/resource');
const SERVICE_NAME = 'flight-service';
const PORT = Number(process.env.PORT) || 3004;

async function main() {
    const pool = await connect(process.env.DB_NAME || resource.dbName);
    await initTable(pool, resource);
    const cache = createCache({
        url: process.env.REDIS_URL,
        prefix: resource.table,
        ttlSeconds: Number(process.env.CACHE_TTL_SECONDS) || 60,
    });

    // Live Google Flights results (SerpApi) are saved into the table before the normal search answers.
    const extend = createLiveSearch({ pool, listCache: cache });
    console.log(`[serpapi] live search ${process.env.SERPAPI_API_KEY ? 'on' : 'off (SERPAPI_API_KEY is not set)'}`);

    const app = createApp({ pool, cache, resource, hooks: undefined, serviceName: SERVICE_NAME, extend });
    const server = app.listen(PORT, () => console.log(`${SERVICE_NAME} listening on port ${PORT}`));

    // On SIGTERM (docker stop), finish open requests then close connections
    const shutdown = () => server.close(async () => { await cache.close(); await pool.end(); process.exit(0); });
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

main().catch((err) => {
    console.error(`${SERVICE_NAME} failed to start:`, err.message);
    process.exit(1);  // Compose restarts it (e.g. while PostgreSQL is still starting)
});
