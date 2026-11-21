// Runs before GET /api/flights. When the search names an origin, a destination and a future date,
// it asks Google Flights (SerpApi) and saves the results as rows in the flights table; the normal
// catalog query then answers, so live and stored flights share ids, filters, sorting and paging.
//
// The X-Flight-Source response header says what happened:
//   live         Google Flights was asked just now and its results are included
//   live-cached  the same route and date were asked recently; those stored results are used
//   fallback     the live search failed (see X-Flight-Notice); only stored flights are shown
//   catalog      no live search for this request (no API key, or no origin/destination/future date)

const express = require('express');
const serpapi = require('./serpapi');

const AIRPORT = /^[A-Za-z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const today = () => new Date().toISOString().slice(0, 10);

// The live-search part of a request, or null when it can't be searched live.
function liveCriteria(query) {
    const { origin, destination, departDate } = query;
    if (![origin, destination, departDate].every((v) => typeof v === 'string')) return null;
    if (!AIRPORT.test(origin) || !AIRPORT.test(destination) || !DATE.test(departDate)) return null;
    if (departDate < today()) return null; // Google Flights only searches future dates
    return { origin: origin.toUpperCase(), destination: destination.toUpperCase(), date: departDate };
}

// Inserts or updates live results; a result found again (same flights, same time) keeps its id.
async function saveRows(pool, rows) {
    const columns = ['airline', 'flight_number', 'origin', 'destination', 'depart_at', 'arrive_at', 'depart_local',
        'arrive_local', 'price', 'currency', 'seats_available', 'stops', 'source', 'external_key'];
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const row of rows) {
            await client.query(
                `INSERT INTO flights (${columns.join(', ')})
                 VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
                 ON CONFLICT (external_key) DO UPDATE SET
                   airline = EXCLUDED.airline, depart_at = EXCLUDED.depart_at, arrive_at = EXCLUDED.arrive_at,
                   depart_local = EXCLUDED.depart_local, arrive_local = EXCLUDED.arrive_local,
                   price = EXCLUDED.price, stops = EXCLUDED.stops`,
                columns.map((c) => row[c]));
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

// Remembers which route/date was searched (30 min) and recent failures (60 s), in memory.
// SerpApi also serves a repeated identical search from its own 1-hour cache without using quota.
function createSearchMemory({
    successTtlMs = (Number(process.env.SERPAPI_REUSE_MINUTES) || 30) * 60000,
    failureTtlMs = 60000,
    now = Date.now,
} = {}) {
    const entries = new Map();
    return {
        async get(key) {
            const entry = entries.get(key);
            if (!entry) return null;
            if (entry.expires <= now()) {
                entries.delete(key);
                return null;
            }
            return entry.value;
        },
        async set(key, value, kind) {
            entries.set(key, { value, expires: now() + (kind === 'failure' ? failureTtlMs : successTtlMs) });
        },
    };
}

// options: { pool, listCache, searchCache, log }; listCache is the Redis cache of GET responses.
function createLiveSearch({ pool, listCache, searchCache = createSearchMemory(), log = console }) {
    const inFlight = new Map(); // the same search arriving twice waits for one call

    async function search(criteria) {
        const key = `${criteria.origin}-${criteria.destination}-${criteria.date}`;
        const remembered = await searchCache.get(key);
        if (remembered?.ok) return { source: 'live-cached' };
        if (remembered && !remembered.ok) {
            return { source: 'fallback', notice: `live search failed recently (${remembered.reason}); try again shortly` };
        }
        if (!inFlight.has(key)) {
            inFlight.set(key, (async () => {
                try {
                    const { rows, attempts } = await serpapi.searchOneWay(criteria, log);
                    if (rows.length) {
                        await saveRows(pool, rows);
                        await listCache.clear(); // cached lists may be missing the new rows
                    }
                    await searchCache.set(key, { ok: true, count: rows.length }, 'success');
                    log.log(`[serpapi] ${key}: ${rows.length} flights saved (${attempts} attempt${attempts > 1 ? 's' : ''})`);
                    return { source: 'live', count: rows.length, attempts };
                } catch (err) {
                    const reason = err.reason || err.message;
                    // Remember the failure briefly so every search does not wait for a slow, failing call.
                    await searchCache.set(key, { ok: false, reason }, 'failure');
                    log.error(`[serpapi] ${key}: falling back to the catalog (${reason})`);
                    return { source: 'fallback', notice: `live search unavailable (${reason}); showing stored flights`, attempts: err.attempts };
                } finally {
                    inFlight.delete(key);
                }
            })());
        }
        return inFlight.get(key);
    }

    const router = express.Router();
    router.get('/', async (req, res, next) => {
        try {
            const criteria = liveCriteria(req.query);
            let outcome;
            if (!serpapi.isConfigured()) outcome = { source: 'catalog', notice: 'live search is off (SERPAPI_API_KEY is not set)' };
            else if (!criteria) outcome = { source: 'catalog' };
            else outcome = await search(criteria);

            res.set('X-Flight-Source', outcome.source);
            if (outcome.notice) res.set('X-Flight-Notice', outcome.notice);
            if (outcome.attempts) res.set('X-Flight-Attempts', String(outcome.attempts));
            next();
        } catch (err) {
            next(err);
        }
    });
    return router;
}

module.exports = { createLiveSearch, createSearchMemory, liveCriteria };
