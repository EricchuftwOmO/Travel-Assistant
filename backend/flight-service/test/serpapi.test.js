// Live Google Flights search (SerpApi) with fetch and the database replaced by fakes:
// time zones, mapping results to rows, timeouts and retries, and the live / cached / fallback paths.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

process.env.SERPAPI_RETRY_DELAY_MS = '1';

const { toUtc } = require('../src/timezones');
const serpapi = require('../src/serpapi');
const { createLiveSearch, createSearchMemory, liveCriteria } = require('../src/liveSearch');

const quiet = { log() {}, warn() {}, error() {} };
const NEXT_YEAR = new Date().getUTCFullYear() + 1;
const DATE = `${NEXT_YEAR}-01-28`;

// A two-leg option in SerpApi's format.
const option = (overrides = {}) => ({
    flights: [
        { departure_airport: { id: 'SEA', time: `${DATE} 10:15` }, arrival_airport: { id: 'ICN', time: `${NEXT_YEAR}-01-29 15:20` },
          duration: 665, airline: 'Korean Air', flight_number: 'KE 20' },
        { departure_airport: { id: 'ICN', time: `${NEXT_YEAR}-01-29 17:30` }, arrival_airport: { id: 'NRT', time: `${NEXT_YEAR}-01-29 19:55` },
          duration: 145, airline: 'Korean Air', flight_number: 'KE 703' },
    ],
    total_duration: 1000, // SEA 10:15 PST (18:15Z) to NRT 19:55 JST next day (10:55Z)
    price: 812,
    ...overrides,
});

let calls;
let replies;
beforeEach(() => {
    calls = [];
    replies = [];
    process.env.SERPAPI_API_KEY = 'test-key';
    global.fetch = async (url) => {
        calls.push(String(url));
        const next = replies.shift() || { status: 200, body: { search_metadata: { status: 'Success' }, best_flights: [] } };
        if (next.throw) throw Object.assign(new Error('boom'), { name: next.throw });
        return { ok: next.status < 300, status: next.status, json: async () => next.body };
    };
});

test('local airport times become UTC, with daylight saving', () => {
    assert.equal(toUtc('2027-01-28 10:15', 'SEA').toISOString(), '2027-01-28T18:15:00.000Z'); // PST, UTC-8
    assert.equal(toUtc('2027-07-01 10:00', 'SEA').toISOString(), '2027-07-01T17:00:00.000Z'); // PDT, UTC-7
    assert.equal(toUtc('2027-01-29 19:55', 'NRT').toISOString(), '2027-01-29T10:55:00.000Z'); // JST, UTC+9
    assert.equal(toUtc('2027-01-29 19:55', 'XXX'), null);
});

test('a two-leg option becomes one row with stops, local times and a key', () => {
    const row = serpapi.toRow(option());
    assert.equal(row.origin, 'SEA');
    assert.equal(row.destination, 'NRT');
    assert.equal(row.stops, 1);
    assert.equal(row.flight_number, 'KE 20');
    assert.equal(row.price, 812);
    assert.equal(row.depart_local, `${DATE} 10:15`);
    assert.equal(row.seats_available, null);
    assert.equal(row.source, 'serpapi');
    assert.equal(row.external_key, `KE 20+KE 703@SEA:${DATE} 10:15`);
    // 18:15Z departure + 1000 minutes = 10:55Z arrival, matching NRT 19:55 local
    assert.equal(new Date(row.arrive_at) - new Date(row.depart_at), 1000 * 60000);
});

test('an unknown airport is worked out from the flight duration', () => {
    const o = option();
    o.flights[1].arrival_airport.id = 'ZZZ';
    const row = serpapi.toRow(o);
    assert.equal(new Date(row.arrive_at) - new Date(row.depart_at), 1000 * 60000);
});

test('the request asks for a one-way search with the key', async () => {
    await serpapi.searchOneWay({ origin: 'sea', destination: 'nrt', date: DATE }, quiet);
    const url = new URL(calls[0]);
    assert.equal(url.origin + url.pathname, 'https://serpapi.com/search');
    assert.equal(url.searchParams.get('engine'), 'google_flights');
    assert.equal(url.searchParams.get('type'), '2');
    assert.equal(url.searchParams.get('departure_id'), 'SEA');
    assert.equal(url.searchParams.get('outbound_date'), DATE);
    assert.equal(url.searchParams.get('api_key'), 'test-key');
});

test('a 503 is retried once and then succeeds', async () => {
    replies = [{ status: 503, body: { error: 'busy' } }, { status: 200, body: { best_flights: [option()] } }];
    const { rows, attempts } = await serpapi.searchOneWay({ origin: 'SEA', destination: 'NRT', date: DATE }, quiet);
    assert.equal(attempts, 2);
    assert.equal(rows.length, 1);
});

test('a timeout is retried, and two timeouts give up', async () => {
    replies = [{ throw: 'TimeoutError' }, { throw: 'TimeoutError' }];
    await assert.rejects(serpapi.searchOneWay({ origin: 'SEA', destination: 'NRT', date: DATE }, quiet), (err) => {
        assert.equal(err.reason, 'timeout');
        assert.equal(err.attempts, 2);
        return true;
    });
});

test('an invalid key is not retried', async () => {
    replies = [{ status: 401, body: { error: 'Invalid API key.' } }];
    await assert.rejects(serpapi.searchOneWay({ origin: 'SEA', destination: 'NRT', date: DATE }, quiet), (err) => {
        assert.equal(err.reason, 'invalid key');
        assert.equal(err.attempts, 1);
        return true;
    });
    assert.equal(calls.length, 1);
});

test('only origin + destination + a future date are searched live', () => {
    assert.deepEqual(liveCriteria({ origin: 'sea', destination: 'nrt', departDate: DATE }), { origin: 'SEA', destination: 'NRT', date: DATE });
    assert.equal(liveCriteria({ origin: 'SEA', destination: 'NRT' }), null);
    assert.equal(liveCriteria({ origin: 'SEA', destination: 'NRT', departDate: '2020-01-01' }), null);
    assert.equal(liveCriteria({ origin: 'Seattle', destination: 'NRT', departDate: DATE }), null);
});

// --- The live-search step in front of GET /api/flights, with a fake database.

function fakePool() {
    const saved = [];
    const client = {
        query: async (sql, params) => { if (sql.startsWith('INSERT')) saved.push(params); },
        release() {},
    };
    return { saved, connect: async () => client };
}

async function request(router, query) {
    const app = express();
    app.use('/api/flights', router);
    app.use('/api/flights', (req, res) => res.json({ ok: true })); // stands in for the catalog query
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    try {
        const res = await new Promise((resolve, reject) => {
            http.get(`http://127.0.0.1:${server.address().port}/api/flights?${new URLSearchParams(query)}`, resolve).on('error', reject);
        });
        res.resume();
        return res.headers;
    } finally {
        server.close();
    }
}

test('live search saves the rows, then reuses them for the same route and date', async () => {
    const pool = fakePool();
    let cleared = 0;
    const router = createLiveSearch({ pool, listCache: { clear: async () => { cleared += 1; } }, searchCache: createSearchMemory(), log: quiet });
    replies = [{ status: 200, body: { best_flights: [option()], other_flights: [option({ price: 900 })] } }];

    const first = await request(router, { origin: 'SEA', destination: 'NRT', departDate: DATE });
    assert.equal(first['x-flight-source'], 'live');
    assert.equal(pool.saved.length, 2);
    assert.equal(cleared, 1);

    const second = await request(router, { origin: 'SEA', destination: 'NRT', departDate: DATE, maxPrice: '850' });
    assert.equal(second['x-flight-source'], 'live-cached');
    assert.equal(calls.length, 1); // SerpApi was asked once
});

test('a failed live search falls back to the catalog and is remembered briefly', async () => {
    const router = createLiveSearch({ pool: fakePool(), listCache: { clear: async () => {} }, searchCache: createSearchMemory(), log: quiet });
    replies = [{ status: 500, body: {} }, { status: 500, body: {} }];

    const first = await request(router, { origin: 'SEA', destination: 'NRT', departDate: DATE });
    assert.equal(first['x-flight-source'], 'fallback');
    assert.match(first['x-flight-notice'], /HTTP 500/);
    assert.equal(first['x-flight-attempts'], '2');

    const second = await request(router, { origin: 'SEA', destination: 'NRT', departDate: DATE });
    assert.equal(second['x-flight-source'], 'fallback');
    assert.equal(calls.length, 2); // not asked again during the 60-second pause
});

test('without a key, or without a date, the catalog answers', async () => {
    const router = createLiveSearch({ pool: fakePool(), listCache: { clear: async () => {} }, searchCache: createSearchMemory(), log: quiet });
    assert.equal((await request(router, { origin: 'SEA', destination: 'NRT' }))['x-flight-source'], 'catalog');
    delete process.env.SERPAPI_API_KEY;
    const off = await request(router, { origin: 'SEA', destination: 'NRT', departDate: DATE });
    assert.equal(off['x-flight-source'], 'catalog');
    assert.match(off['x-flight-notice'], /SERPAPI_API_KEY/);
    assert.equal(calls.length, 0);
});
