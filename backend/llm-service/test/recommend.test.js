// Tests for the recommendation logic and route. Upstream services are faked; no database, Redis or API key needed.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

delete process.env.GROQ_API_KEY;

const { validateRequest, computeCost, selectByRules, resolveChoice } = require('../src/recommend');

const flights = [
    { id: 1, airline: 'Alaska', flight_number: 'AS 21', origin: 'SEA', destination: 'HND', price: 845.5, currency: 'USD' },
    { id: 2, airline: 'ANA', flight_number: 'NH 177', origin: 'SEA', destination: 'HND', price: 912, currency: 'USD' },
];
const hotels = [
    { id: 1, name: 'Hotel Gracery', price_per_night: 165, rating: 8.6, currency: 'USD' },
    { id: 2, name: 'Tokyo Station Hotel', price_per_night: 410, rating: 9.2, currency: 'USD' },
    { id: 3, name: 'Sakura Capsule', price_per_night: 48, rating: 7.4, currency: 'USD' },
];
const cars = [
    { id: 1, company: 'Toyota Rent a Car', model: 'Toyota Yaris', price_per_day: 61, currency: 'USD' },
    { id: 2, company: 'Nippon', model: 'Alphard', price_per_day: 148, currency: 'USD' },
];
const activities = [
    { id: 1, name: 'Senso-ji', price: 0, rating: 4.7, currency: 'USD' },
    { id: 2, name: 'Tsukiji tour', price: 65, rating: 4.8, currency: 'USD' },
    { id: 3, name: 'teamLab', price: 32, rating: 4.6, currency: 'USD' },
    { id: 4, name: 'Night market', price: 15, rating: 4.5, currency: 'USD' },
];

test('validateRequest fills defaults and normalises the airport code', () => {
    const r = validateRequest({ user_id: 'u1', destination: 'Tokyo', budget: 2500, origin: 'sea' });
    assert.equal(r.nights, 3); assert.equal(r.travelers, 1); assert.equal(r.currency, 'USD'); assert.equal(r.origin, 'SEA');
});

test('validateRequest lists every problem at once', () => {
    assert.throws(() => validateRequest({ budget: -5, nights: 1.5, bogus: true }), (err) => {
        assert.equal(err.status, 400);
        const fields = err.details.map((d) => d.field).sort();
        assert.deepEqual(fields, ['bogus', 'budget', 'destination', 'nights', 'user_id']);
        return true;
    });
});

test('computeCost adds flights x travelers, hotel x nights and activities x travelers', () => {
    const cost = computeCost({ flight: flights[1], hotel: hotels[0], activities: [activities[1], activities[2], activities[0]] },
        { nights: 5, travelers: 1, budget: 2500 });
    assert.deepEqual(cost.breakdown, { flights: 912, hotel: 825, car_rental: 0, activities: 97 });
    assert.equal(cost.total, 1834);
    assert.equal(cost.within_budget, true);
    assert.equal(cost.remaining, 666);
});

test('computeCost multiplies per-person items by travelers', () => {
    const cost = computeCost({ flight: flights[0], hotel: hotels[2], activities: [activities[3]] }, { nights: 2, travelers: 2, budget: 5000 });
    assert.equal(cost.breakdown.flights, 1691);
    assert.equal(cost.breakdown.hotel, 96);       // a room, not per person
    assert.equal(cost.breakdown.activities, 30);
});

test('a rental car is charged per day for the whole trip, once (not per traveler)', () => {
    const request = { nights: 3, travelers: 2, budget: 5000 };
    const sel = selectByRules({ flights, hotels, activities, cars }, request);
    assert.equal(sel.car.id, 1);
    assert.equal(computeCost(sel, request).breakdown.car_rental, 183);
    assert.equal(selectByRules({ flights, hotels, activities }, request).car, null);
});

test('selectByRules picks the cheapest flight and the best hotel that fits the budget', () => {
    const sel = selectByRules({ flights, hotels, activities }, { nights: 5, travelers: 1, budget: 2500 });
    assert.equal(sel.flight.id, 1);
    assert.equal(sel.hotel.id, 1);                 // Tokyo Station Hotel (5 x 410) would not fit; best fitting is Gracery
    assert.equal(sel.activities.length, 3);
    assert.ok(computeCost(sel, { nights: 5, travelers: 1, budget: 2500 }).within_budget);
});

test('selectByRules falls back to the cheapest hotel and reports over budget when nothing fits', () => {
    const request = { nights: 5, travelers: 1, budget: 900 };
    const sel = selectByRules({ flights, hotels, activities }, request);
    assert.equal(sel.hotel.id, 3);
    assert.equal(computeCost(sel, request).within_budget, false);
});

test('resolveChoice rejects ids that are not in the results (the model cannot invent items)', () => {
    assert.equal(resolveChoice({ flight_id: 99, hotel_id: 1, activity_ids: [] }, { flights, hotels, activities }), null);
    assert.equal(resolveChoice({ flight_id: 1, hotel_id: 1, activity_ids: [2, 77] }, { flights, hotels, activities }), null);
    const ok = resolveChoice({ flight_id: 1, hotel_id: 1, activity_ids: [2] }, { flights, hotels, activities });
    assert.equal(ok.activities[0].name, 'Tsukiji tour');
});

function fakeService(handler) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const url = new URL(req.url, 'http://x');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(handler(url)));
        });
        server.listen(0, () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
    });
}

async function startApp({ flightUp = true } = {}) {
    const f = await fakeService((url) => ({ data: url.searchParams.get('destination') === 'HND' ? flights : [] }));
    const h = await fakeService((url) => ({ data: url.searchParams.get('city').toLowerCase() === 'tokyo' ? hotels : [] }));
    const a = await fakeService((url) => ({ data: url.searchParams.get('city').toLowerCase() === 'tokyo' ? activities : [] }));
    if (!flightUp) await new Promise((r) => f.server.close(r));
    const c = await fakeService((url) => ({ data: url.searchParams.get('city').toLowerCase() === 'tokyo' ? cars : [] }));
    process.env.FLIGHT_SERVICE_URL = f.url; process.env.HOTEL_SERVICE_URL = h.url; process.env.ACTIVITY_SERVICE_URL = a.url; process.env.CAR_RENTAL_SERVICE_URL = c.url;

    const saved = [];
    const pool = { query: async (sql, params) => (sql.startsWith('INSERT') ? (saved.push(params), { rows: [{ id: 42 }] }) : { rows: [{}] }) };
    const cache = { enabled: false, get: async () => null, set: async () => {}, clear: async () => {}, close: async () => {} };
    const { createApp } = require('../src/app');
    const resource = require('../src/resource');
    const { recommendRouter } = require('../src/recommend');
    const app = createApp({ pool, cache, resource, serviceName: 'llm-service', extend: recommendRouter(pool) });
    const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
    return {
        base: `http://127.0.0.1:${server.address().port}`, saved,
        close: () => Promise.all([server, f.server, h.server, a.server, c.server].map((s) => new Promise((r) => { s.close(r); s.closeAllConnections?.(); }))),
    };
}

const post = (base, body) => fetch(`${base}/api/advice/recommendations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('POST /api/advice/recommendations builds, costs and saves a recommendation (201)', async () => {
    const app = await startApp();
    try {
        const res = await post(app.base, { user_id: 'u1', trip_id: 1, origin: 'SEA', destination: 'Tokyo', nights: 5, travelers: 1, budget: 2500 });
        assert.equal(res.status, 201);
        assert.equal(res.headers.get('location'), '/api/advice/42');
        const body = await res.json();
        assert.equal(body.id, 42);
        assert.equal(body.within_budget, true);
        assert.equal(body.total, body.breakdown.flights + body.breakdown.hotel + body.breakdown.activities);
        assert.equal(body.selection.flight_id, 1);
        assert.equal(body.source, 'stub');
        assert.match(body.summary, /Total \$/);
        assert.equal(app.saved.length, 1);
    } finally { await app.close(); }
});

test('POST /api/advice/recommendations adds a rental car only when asked', async () => {
    const app = await startApp();
    try {
        const without = await (await post(app.base, { user_id: 'u1', origin: 'SEA', destination: 'Tokyo', nights: 3, budget: 5000 })).json();
        assert.equal(without.selection.car_rental_id, null);
        assert.equal(without.breakdown.car_rental, 0);
        const withCar = await (await post(app.base, { user_id: 'u1', origin: 'SEA', destination: 'Tokyo', nights: 3, budget: 5000, include_car: true })).json();
        assert.equal(withCar.selection.car_rental_id, 1);
        assert.equal(withCar.breakdown.car_rental, 183);
        assert.equal(withCar.total, withCar.breakdown.flights + withCar.breakdown.hotel + withCar.breakdown.car_rental + withCar.breakdown.activities);
        assert.match(withCar.summary, /rent a Toyota Yaris/);
    } finally { await app.close(); }
});

test('POST /api/advice/recommendations returns 400 with every invalid field', async () => {
    const app = await startApp();
    try {
        const res = await post(app.base, { destination: 'Tokyo' });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.error.code, 'BAD_REQUEST');
        assert.deepEqual(body.error.details.map((d) => d.field).sort(), ['budget', 'user_id']);
        assert.equal(app.saved.length, 0);
    } finally { await app.close(); }
});

test('POST /api/advice/recommendations returns 404 when nothing is found for the destination', async () => {
    const app = await startApp();
    try {
        const res = await post(app.base, { user_id: 'u1', destination: 'Atlantis', budget: 1000 });
        assert.equal(res.status, 404);
        assert.equal((await res.json()).error.code, 'NOT_FOUND');
        assert.equal(app.saved.length, 0);
    } finally { await app.close(); }
});

test('POST /api/advice/recommendations returns 502 and saves nothing when a search service is down', async () => {
    const app = await startApp({ flightUp: false });
    try {
        const res = await post(app.base, { user_id: 'u1', origin: 'SEA', destination: 'Tokyo', budget: 2500 });
        assert.equal(res.status, 502);
        assert.equal((await res.json()).error.code, 'SERVICE_UNAVAILABLE');
        assert.equal(app.saved.length, 0);
    } finally { await app.close(); }
});
