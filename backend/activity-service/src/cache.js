// TCSS 559 Autumn 2026
// Travel Assistant - optional Redis cache for GET responses.
// If REDIS_URL is not set, or Redis is down, every call quietly does nothing and
// the service reads from PostgreSQL as usual: the cache can never break a request.
//
// Invalidation: all keys carry a version number; a write bumps it, which makes
// every older cached response unreachable (they expire on their own).

const { createClient } = require('redis');

function createCache({ url, prefix, ttlSeconds = 60 }) {
    if (!url) return { enabled: false, get: async () => null, set: async () => {}, clear: async () => {}, close: async () => {} };

    const client = createClient({
        url,
        disableOfflineQueue: true,                 // fail fast while Redis is down
        socket: { reconnectStrategy: (tries) => Math.min(tries * 200, 3000) },
    });
    let reportedDown = false;
    client.on('error', (err) => {
        if (!reportedDown) console.error(`[cache] redis unavailable: ${err.message}`);
        reportedDown = true;
    });
    client.on('ready', () => { reportedDown = false; console.log('[cache] redis connected'); });
    client.connect().catch(() => {});

    const versionKey = `${prefix}:version`;
    const keyFor = async (path) => `${prefix}:${(await client.get(versionKey)) || 0}:${path}`;

    return {
        enabled: true,
        async get(path) {
            try {
                const hit = await client.get(await keyFor(path));
                return hit ? JSON.parse(hit) : null;
            } catch { return null; }
        },
        async set(path, value) {
            try { await client.set(await keyFor(path), JSON.stringify(value), { EX: ttlSeconds }); } catch { /* ignore */ }
        },
        async clear() {
            try { await client.incr(versionKey); } catch { /* ignore */ }
        },
        async close() {
            try { await client.quit(); } catch { /* ignore */ }
        },
    };
}

module.exports = { createCache };
