// The pre-trip notes chain with fake user and trip services and a fake model (no network, no key, no database).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { notesRouter, buildFacts, ruleNotes, cleanNotes, mergeNotes } = require('../src/notes');

// Trip 7 belongs to user 3: Taipei, 4 days; the flight lands on day 2, and a place is planned on day 1.
const TRIP = {
    id: 7, ownerId: 3, title: 'Taipei Trip', destination: 'Taipei', startDate: '2027-01-31', endDate: '2027-02-03',
    flights: [{ id: 55, airline: 'EVA Air', flightNumber: 'BR 17', origin: 'SEA', destination: 'TPE',
        departAt: '2027-01-31T01:30:00.000Z', arriveAt: '2027-02-01T05:15:00.000Z', price: 698 }],
};
const DAYS = [
    { dayNumber: 1, date: '2027-01-31', placeCount: 1 },
    { dayNumber: 2, date: '2027-02-01', placeCount: 0 },
    { dayNumber: 3, date: '2027-02-02', placeCount: 1 },
    { dayNumber: 4, date: '2027-02-03', placeCount: 0 },
];
const ITEMS = {
    1: [{ id: 11, position: 1, place: { name: 'Taipei 101', category: 'attraction' } }],
    3: [{ id: 12, position: 1, place: { name: 'Shilin Night Market', category: 'food' } }],
};
const ME = { country: 'United States', languageSettings: { language: 'en' }, travelPreferences: { budgetLevel: 'mid', travelStyles: ['food'] } };

// Answers like the user and trip services; records every URL and header it was sent.
function fakeServices({ userUp = true, tripStatus = 200 } = {}) {
    const calls = [];
    const fetchImpl = async (url, init) => {
        const u = new URL(url);
        calls.push({ path: u.pathname, headers: init.headers });
        const reply = (status, body) => ({ ok: status < 300, status, json: async () => body });
        if (u.pathname === '/api/users/me') {
            if (!userUp) throw new Error('connect ECONNREFUSED');
            return reply(200, ME);
        }
        if (init.headers['X-User-Id'] !== '3' || !u.pathname.startsWith('/api/trips/7')) return reply(404, {});
        if (tripStatus !== 200) return reply(tripStatus, {});
        if (u.pathname === '/api/trips/7') return reply(200, TRIP);
        if (u.pathname === '/api/trips/7/itineraries') return reply(200, DAYS);
        const day = Number(u.pathname.split('/').pop());
        return reply(200, { ...DAYS[day - 1], items: ITEMS[day] || [] });
    };
    return { fetchImpl, calls };
}

async function start(options) {
    const app = express();
    app.use(express.json());
    app.use('/api/advice', notesRouter({ userServiceUrl: 'http://user', tripServiceUrl: 'http://trip', ...options }));
    app.use((err, req, res, next) => res.status(err.status || 500).json({ error: { code: err.code, message: err.message } }));
    const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (body, headers = { 'X-User-Id': '3', Authorization: 'Bearer t' }) =>
        fetch(`${base}/api/advice/trip-notes`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    return { post, close: () => new Promise((r) => { server.close(r); server.closeAllConnections?.(); }) };
}

const facts = () => buildFacts({
    trip: TRIP,
    days: DAYS.map((d) => ({ ...d, items: ITEMS[d.dayNumber] || [] })),
}, { home_country: 'United States' });

test('the code finds plan problems itself: a place before the flight lands, days spent travelling, empty days', () => {
    const { checks, trip } = facts();
    assert.equal(checks.arrival_date, '2027-02-01');
    assert.deepEqual(checks.days_before_arrival, [1]);
    assert.deepEqual(checks.items_before_arrival.map((i) => i.item_id), [11]);
    assert.deepEqual(checks.empty_days, [2, 4]);
    assert.deepEqual(trip.months, ['January', 'February']);
});

test('stub notes say only what the code knows: entry check first, then the plan problems', () => {
    const notes = ruleNotes(facts());
    assert.equal(notes[0].priority, 'high');
    assert.ok(notes.some((n) => n.category === 'entry' && /United States passport/.test(n.detail)));
    assert.ok(notes.some((n) => n.item_id === 11 && n.day === 1));
    assert.ok(notes.some((n) => n.category === 'itinerary' && /Days 2 and 4/.test(n.title)));
});

test('places before the flight lands are grouped into one note per day', () => {
    const twoOnDayOne = buildFacts({
        trip: TRIP,
        days: DAYS.map((d) => ({ ...d, items: d.dayNumber === 1 ? [...ITEMS[1], { id: 13, place: { name: 'Din Tai Fung' } }] : ITEMS[d.dayNumber] || [] })),
    }, null);
    const dayOne = ruleNotes(twoOnDayOne).filter((n) => n.category === 'itinerary' && n.day === 1);
    assert.equal(dayOne.length, 1);
    assert.equal(dayOne[0].title, 'Day 1: 2 places before you land');
    assert.equal(dayOne[0].item_id, null);
    assert.match(dayOne[0].detail, /Taipei 101 and Din Tai Fung are on Day 1/);
});

test("the model's JSON is checked: unknown categories, days and places are dropped, an item's day is corrected", () => {
    const notes = cleanNotes({
        notes: [
            { category: 'culture', priority: 'medium', title: 'Tipping', detail: 'Tipping is not expected.' },
            { category: 'parties', priority: 'high', title: 'Bad category', detail: 'x' },
            { category: 'itinerary', priority: 'high', title: 'Day 9', detail: 'No such day', day: 9 },
            { category: 'itinerary', priority: 'high', title: 'Made-up place', detail: 'No such item', item_id: 999 },
            { category: 'itinerary', priority: 'urgent', title: 'Night market', detail: 'Go hungry.', day: 1, item_id: 12 },
            { category: 'weather', title: '', detail: 'empty title' },
        ],
    }, facts());
    assert.deepEqual(notes.map((n) => n.title), ['Tipping', 'Night market']);
    assert.equal(notes[1].day, 3);           // item 12 is on day 3
    assert.equal(notes[1].priority, 'medium'); // unknown priority
    assert.equal(cleanNotes({ notes: 'nope' }, facts()), null);
    assert.equal(cleanNotes({ notes: [{ category: 'x' }] }, facts()), null);
});

test("the code's own findings and the entry reminder are kept even when the model leaves them out", () => {
    const notes = mergeNotes([{ category: 'culture', priority: 'low', title: 'Tipping', detail: 'Not expected.', day: null, item_id: null }], facts());
    assert.ok(notes.some((n) => n.item_id === 11));
    assert.ok(notes.some((n) => n.category === 'entry'));
    assert.equal(notes[0].priority, 'high');
    assert.equal(notes[notes.length - 1].priority, 'low');
});

test('POST /trip-notes runs the chain in order and returns the model notes (source llm)', async () => {
    const { fetchImpl, calls } = fakeServices();
    const sent = [];
    const complete = async (messages) => {
        sent.push(messages);
        return JSON.stringify({ notes: [
            { category: 'culture', priority: 'medium', title: 'Queue politely', detail: 'People line up for the MRT.', day: null, item_id: null },
            { category: 'electricity', priority: 'medium', title: 'Type A/B plugs, 110 V', detail: 'Same as the US.', day: null, item_id: null },
        ] });
    };
    const app = await start({ fetchImpl, complete });
    try {
        const res = await app.post({ trip_id: 7 });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.source, 'llm');
        assert.equal(body.destination, 'Taipei');
        assert.ok(body.notes.some((n) => n.title === 'Queue politely'));
        assert.ok(body.notes.some((n) => n.item_id === 11)); // added by the code

        // user-service got the token; trip-service got the user id; only day 1 and 3 were read (they have places)
        assert.equal(calls.find((c) => c.path === '/api/users/me').headers.Authorization, 'Bearer t');
        assert.deepEqual(calls.filter((c) => c.path.startsWith('/api/trips')).map((c) => c.path).sort(),
            ['/api/trips/7', '/api/trips/7/itineraries', '/api/trips/7/itineraries/1', '/api/trips/7/itineraries/3']);

        // one model call, no tools, with the facts the code gathered
        assert.equal(sent.length, 1);
        const facts = JSON.parse(sent[0][1].content);
        assert.equal(facts.traveler.home_country, 'United States');
        assert.deepEqual(facts.checks.days_before_arrival, [1]);
    } finally { await app.close(); }
});

test('POST /trip-notes falls back to rules when the model fails or answers badly (source stub)', async () => {
    for (const complete of [async () => { throw new Error('rate limited'); }, async () => 'not json', async () => '{"notes":[]}']) {
        const app = await start({ fetchImpl: fakeServices().fetchImpl, complete });
        try {
            const body = await (await app.post({ trip_id: 7 })).json();
            assert.equal(body.source, 'stub');
            assert.ok(body.notes.some((n) => n.category === 'entry'));
        } finally { await app.close(); }
    }
});

test('POST /trip-notes still works when the user service is down (no home country)', async () => {
    const app = await start({ fetchImpl: fakeServices({ userUp: false }).fetchImpl });
    try {
        const res = await app.post({ trip_id: 7 });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(!/passport for/.test(body.notes.find((n) => n.category === 'entry').detail));
    } finally { await app.close(); }
});

test('POST /trip-notes: 401 without a user, 400 for a bad trip id, 404 for another user\'s trip, 502 when the trip service fails', async () => {
    const app = await start({ fetchImpl: fakeServices().fetchImpl });
    try {
        assert.equal((await app.post({ trip_id: 7 }, {})).status, 401);
        assert.equal((await app.post({ trip_id: 'x' })).status, 400);
        assert.equal((await app.post({ trip_id: 7 }, { 'X-User-Id': '4' })).status, 404);
    } finally { await app.close(); }
    const down = await start({ fetchImpl: fakeServices({ tripStatus: 500 }).fetchImpl });
    try {
        assert.equal((await down.post({ trip_id: 7 })).status, 502);
    } finally { await down.close(); }
});
