// GraphQL tests: stub services that answer like the real REST services, queries sent through the gateway.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../src/app');

const token = 'good-token'; // the stub user service accepts this one (as user 7)

const servers = [];
const seen = []; // every request a stub service received: { service, url, authorization }

function listen(handler) {
    return new Promise((resolve) => {
        const server = http.createServer(handler);
        server.listen(0, '127.0.0.1', () => {
            servers.push(server);
            resolve(`http://127.0.0.1:${server.address().port}`);
        });
    });
}

const readBody = (req) => new Promise((resolve) => {
    let text = '';
    req.on('data', (chunk) => { text += chunk; });
    req.on('end', () => resolve(text ? JSON.parse(text) : {}));
});

const json = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
};

const FLIGHT = { id: 1, airline: 'ANA', flight_number: 'NH 177', origin: 'SEA', destination: 'HND',
    depart_at: '2026-12-01T19:40:00.000Z', arrive_at: '2026-12-03T00:10:00.000Z', price: '912.00', currency: 'USD', seats_available: 5 };
const HOTEL = { id: 2, name: 'Tokyo Station Hotel', city: 'Tokyo', country: 'Japan', address: null, stars: 5,
    price_per_night: '410.00', currency: 'USD', rating: '9.20', available: true };
const CAR = { id: 3, company: 'Toyota Rent a Car', car_type: 'compact', model: 'Toyota Yaris', pickup_city: 'Tokyo',
    seats: 5, transmission: 'automatic', price_per_day: '61.00', currency: 'USD', available: true };
const ACTIVITY = { id: 4, name: 'Senso-ji Temple', city: 'Tokyo', category: 'sightseeing', description: null,
    price: '0.00', currency: 'USD', duration_minutes: 90, rating: '4.70' };
const USER = { id: 7, firstName: 'Alice', lastName: 'Chen', name: 'Alice Chen', email: 'alice@example.com',
    createdAt: '2026-11-06T18:00:00.000Z', language: 'en', timezone: 'America/Los_Angeles',
    languageSettings: { language: 'en', timezone: 'America/Los_Angeles' },
    travelPreferences: { budgetLevel: 'MODERATE', travelStyles: ['FOOD'] } };
const TRIP_FLIGHT = { id: 3, tripId: 1, flightId: 4, airline: 'ANA', flightNumber: 'NH 177', origin: 'SEA', destination: 'HND',
    departAt: '2027-01-28T19:40:00.000Z', arriveAt: '2027-01-30T00:10:00.000Z', price: 912, currency: 'USD', createdAt: '2026-11-06T18:00:00.000Z' };
const PLACE = { id: 5, googlePlaceId: null, name: 'Senso-ji Temple', city: 'Tokyo', category: 'attraction', address: null, lat: 35.71, lng: 139.79 };
const ITEM = { id: 9, position: 2, place: PLACE };
const DAY = { id: 11, tripId: 1, dayNumber: 1, date: '2027-01-28' };
const NEARBY = { googlePlaceId: 'ChIJabc', name: 'Ichiran', address: '1 Chome', lat: 35.7, lng: 139.7, category: 'food',
    type: 'Ramen restaurant', rating: 4.5, ratingCount: 1200 };
const LOCATED = { name: 'Tokyo', lat: 35.68, lng: 139.69, viewport: { north: 36, east: 140, south: 35, west: 139 } };
const ADVICE = { id: 1, user_id: '7', trip_id: 1, topic: 'packing', prompt: 'What to pack?', content: 'Layers.',
    model: 'sample', source: 'user', created_at: '2026-11-06T18:00:00.000Z' };
const TRIP = { id: 1, ownerId: 7, title: 'Japan Trip', destination: 'Tokyo', startDate: '2027-01-28', endDate: '2027-02-03',
    createdAt: '2026-11-06T18:00:00.000Z' };

function stub(name, listItem, base) {
    return listen((req, res) => {
        seen.push({ service: name, url: req.url, authorization: req.headers.authorization });
        const { pathname } = new URL(req.url, 'http://x');
        if (pathname === base) return json(res, 200, { count: 1, total: 1, data: [listItem] });
        if (pathname === `${base}/${listItem.id}`) return json(res, 200, listItem);
        json(res, 404, { error: { code: 'NOT_FOUND', message: 'not found' } });
    });
}

let gateway;

async function gql(query, { auth = true, variables } = {}) {
    const res = await fetch(`${gateway}/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(auth && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ query, variables }),
    });
    return res.json();
}

before(async () => {
    const tripUrl = await listen(async (req, res) => {
        const body = await readBody(req);
        seen.push({ service: 'trip', method: req.method, url: req.url, authorization: req.headers.authorization,
            userId: req.headers['x-user-id'], body });
        // Like the real Trip Service: no X-User-Id, no answer
        if (!req.headers['x-user-id']) return json(res, 401, { error: { code: 'UNAUTHORIZED', message: 'A signed-in user is required' } });
        const { pathname, searchParams } = new URL(req.url, 'http://x');
        const route = `${req.method} ${pathname}`;
        const notFound = (message) => json(res, 404, { error: { code: 'NOT_FOUND', message } });

        if (route === 'GET /api/trips') return json(res, 200, [TRIP]);
        if (route === 'POST /api/trips') {
            if (!body.title) return json(res, 400, { error: { code: 'BAD_REQUEST', message: 'Request validation failed', details: ['title is required and must be a non-empty string'] } });
            return json(res, 201, { ...TRIP, ...body, flightId: undefined, flights: body.flightId ? [TRIP_FLIGHT] : [] });
        }
        if (route === 'GET /api/trips/1') return json(res, 200, { ...TRIP, flights: [TRIP_FLIGHT] });
        if (route === 'PUT /api/trips/1') {
            if (body.endDate === '2027-01-29') return json(res, 409, { error: { code: 'CONFLICT', message: 'The new dates would remove days that still have places', details: ['Day 7 has places; remove them first'] } });
            return json(res, 200, { ...TRIP, ...body });
        }
        if (route === 'DELETE /api/trips/1') return (res.writeHead(204), res.end());
        if (route === 'GET /api/trips/1/flights') return json(res, 200, [TRIP_FLIGHT]);
        if (route === 'POST /api/trips/1/flights') {
            if (body.flightId === 5) return json(res, 409, { error: { code: 'CONFLICT', message: 'This flight is already on the trip' } });
            return json(res, 201, TRIP_FLIGHT);
        }
        if (route === 'DELETE /api/trips/1/flights/3') return (res.writeHead(204), res.end());
        if (route === 'GET /api/trips/1/itineraries') return json(res, 200, [{ ...DAY, placeCount: 1 }]);
        if (route === 'GET /api/trips/1/itineraries/1') return json(res, 200, { ...DAY, items: [ITEM] });
        if (route === 'POST /api/trips/1/itineraries/1/items') {
            if (body.placeId !== undefined && body.googlePlaceId !== undefined) {
                return json(res, 400, { error: { code: 'BAD_REQUEST', message: 'Request validation failed', details: ['send either placeId (sample catalog) or googlePlaceId (Google Places), not both'] } });
            }
            return json(res, 201, ITEM);
        }
        if (route === 'PUT /api/trips/1/itineraries/1/items/order') {
            return json(res, 200, { ...DAY, items: [{ ...ITEM, id: 8, position: 1 }, { ...ITEM, id: 9, position: 2 }] });
        }
        if (route === 'DELETE /api/trips/1/itineraries/1/items/9') return (res.writeHead(204), res.end());
        if (pathname === '/api/places') return json(res, 200, [ITEM.place]);
        if (pathname === '/api/places/config') return json(res, 200, { googlePlaces: true });
        if (pathname === '/api/places/nearby') return json(res, 200, [NEARBY]);
        if (pathname === '/api/places/locate') {
            return searchParams.get('q') === 'Tokyo' ? json(res, 200, LOCATED) : notFound('No location found');
        }
        notFound(pathname.startsWith('/api/trips') ? 'Trip not found' : 'Not found');
    });
    const llmUrl = await listen(async (req, res) => {
        const body = await readBody(req);
        seen.push({ service: 'llm', method: req.method, url: req.url, authorization: req.headers.authorization, userId: req.headers['x-user-id'], body });
        const { pathname } = new URL(req.url, 'http://x');
        if (req.method === 'GET' && pathname === '/api/advice') return json(res, 200, { count: 1, total: 1, data: [ADVICE] });
        if (req.method === 'POST' && pathname === '/api/advice/trip-notes') {
            if (body.trip_id !== 1) return json(res, 404, { error: { code: 'NOT_FOUND', message: `Trip ${body.trip_id} not found` } });
            return json(res, 200, { trip_id: 1, destination: 'Tokyo', start_date: '2027-01-28', end_date: '2027-02-03', source: 'stub', model: 'stub',
                generated_at: '2026-11-21T00:00:00.000Z', notes: [{ category: 'itinerary', priority: 'high', title: 'Too early', detail: 'Move it.', day: 1, item_id: 9 }] });
        }
        if (req.method === 'POST' && pathname === '/api/advice') {
            return json(res, 201, { ...ADVICE, id: 2, ...body, content: 'Pack layers.', source: 'stub' });
        }
        json(res, 404, { error: { code: 'NOT_FOUND', message: 'not found' } });
    });
    const userUrl = await listen((req, res) => {
        const bearer = req.headers.authorization;
        seen.push({ service: 'user', method: req.method, url: req.url, authorization: bearer });
        const { pathname } = new URL(req.url, 'http://x');
        const read = () => new Promise((resolve) => {
            let body = '';
            req.on('data', (c) => { body += c; });
            req.on('end', () => resolve(body ? JSON.parse(body) : {}));
        });
        const denied = () => {
            if (bearer === `Bearer ${token}`) return false;
            json(res, 401, { error: { code: 'UNAUTHORIZED', message: 'A valid bearer token is required' } });
            return true;
        };

        if (pathname === '/api/auth/validate') return denied() || json(res, 200, { userId: 7 });
        if (pathname === '/api/auth/login') {
            return read().then((b) => b.password === 'Password123!'
                ? json(res, 200, { token, user: { ...USER, languageSettings: undefined, travelPreferences: undefined } })
                : json(res, 401, { error: { code: 'UNAUTHORIZED', message: 'Email or password is incorrect' } }));
        }
        if (pathname === '/api/auth/google') {
            return read().then((b) => b.credential === 'google-ok'
                ? json(res, 200, { token, user: USER })
                : json(res, 401, { error: { code: 'UNAUTHORIZED', message: 'Google token is invalid or expired' } }));
        }
        if (pathname === '/api/users/me' && req.method === 'GET') return denied() || json(res, 200, USER);
        if (pathname === '/api/users/me/basic-info') {
            return denied() || read().then((b) => b.phone === 'call me'
                ? json(res, 400, { error: { code: 'BAD_REQUEST', message: 'Request validation failed', details: ['phone must be a phone number'] } })
                : json(res, 200, { ...USER, ...b }));
        }
        if (pathname === '/api/users/me' && req.method === 'DELETE') return denied() || (res.writeHead(204), res.end());
        json(res, 404, { error: { code: 'NOT_FOUND', message: 'not found' } });
    });
    const config = {
        corsOrigins: [], healthPath: '/health', healthTimeoutMs: 500, logRequests: false,
        services: {
            user: { url: userUrl, timeoutMs: 1000 },
            trip: { url: tripUrl, timeoutMs: 1000 },
            llm: { url: llmUrl, timeoutMs: 1000 },
            flight: { url: await stub('flight', FLIGHT, '/api/flights'), timeoutMs: 1000 },
            hotel: { url: await stub('hotel', HOTEL, '/api/hotels'), timeoutMs: 1000 },
            carRental: { url: await stub('carRental', CAR, '/api/car-rentals'), timeoutMs: 1000 },
            search: { url: await stub('search', ACTIVITY, '/api/activities'), timeoutMs: 1000 },
        },
    };
    gateway = await listen(createApp(config));
});

after(() => {
    for (const server of servers) server.closeAllConnections();
    return Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
});

test('flights: maps snake_case to camelCase and forwards filters (no login needed)', async () => {
    seen.length = 0;
    const { data, errors } = await gql(
        '{ flights(origin: "SEA", maxPrice: 1000, sort: departAt, order: desc) { flightNumber departAt price seatsAvailable } }',
        { auth: false });
    assert.equal(errors, undefined);
    assert.deepEqual(data.flights, [{ flightNumber: 'NH 177', departAt: FLIGHT.depart_at, price: 912, seatsAvailable: 5 }]);
    const url = new URL(seen[0].url, 'http://x');
    assert.equal(url.searchParams.get('origin'), 'SEA');
    assert.equal(url.searchParams.get('maxPrice'), '1000');
    assert.equal(url.searchParams.get('sort'), 'depart_at');
    assert.equal(url.searchParams.get('order'), 'desc');
});

test('one query combines hotels, car rentals and activities', async () => {
    const { data, errors } = await gql(`{
        hotel(id: 2) { name pricePerNight rating }
        carRental(id: 3) { carType pickupCity pricePerDay }
        activity(id: 4) { name durationMinutes }
    }`, { auth: false });
    assert.equal(errors, undefined);
    assert.deepEqual(data, {
        hotel: { name: 'Tokyo Station Hotel', pricePerNight: 410, rating: 9.2 },
        carRental: { carType: 'compact', pickupCity: 'Tokyo', pricePerDay: 61 },
        activity: { name: 'Senso-ji Temple', durationMinutes: 90 },
    });
});

test('a missing item is null, not an error', async () => {
    const { data, errors } = await gql('{ flight(id: 999) { id } }', { auth: false });
    assert.equal(errors, undefined);
    assert.equal(data.flight, null);
});

test('trip fans out to the hotel, activity and car rental services by destination city', async () => {
    seen.length = 0;
    const { data, errors } = await gql(`{
        trip(id: 1) {
            title destination
            hotels(minStars: 4) { name }
            activities { name }
            carRentals { model }
        }
    }`);
    assert.equal(errors, undefined);
    assert.deepEqual(data.trip, {
        title: 'Japan Trip', destination: 'Tokyo',
        hotels: [{ name: 'Tokyo Station Hotel' }],
        activities: [{ name: 'Senso-ji Temple' }],
        carRentals: [{ model: 'Toyota Yaris' }],
    });
    const hotelCall = new URL(seen.find((r) => r.service === 'hotel').url, 'http://x');
    assert.equal(hotelCall.searchParams.get('city'), 'Tokyo');
    assert.equal(hotelCall.searchParams.get('minStars'), '4');
    const tripCall = seen.find((r) => r.service === 'trip');
    assert.equal(tripCall.userId, '7');              // the user service said who the caller is
    assert.equal(tripCall.authorization, undefined); // the token itself is not passed to the Trip Service
});

test('myTrips without a token is UNAUTHENTICATED', async () => {
    const { data, errors } = await gql('{ myTrips { id } }', { auth: false });
    assert.equal(data, null);
    assert.equal(errors[0].extensions.code, 'UNAUTHENTICATED');
});

test('a service that is down gives UPSTREAM_UNAVAILABLE on that field only', async () => {
    const dead = await listen(() => {});
    const server = servers.pop();
    await new Promise((resolve) => server.close(resolve));
    const gw = await listen(createApp({
        corsOrigins: [], healthPath: '/health', healthTimeoutMs: 500, logRequests: false,
        services: {
            flight: { url: dead, timeoutMs: 1000 },
            hotel: { url: await stub('hotel', HOTEL, '/api/hotels'), timeoutMs: 1000 },
        },
    }));
    const res = await fetch(`${gw}/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ flights { id } hotels { name } }' }),
    });
    const { data, errors } = await res.json();
    assert.equal(errors[0].extensions.code, 'UPSTREAM_UNAVAILABLE');
    assert.deepEqual(errors[0].path, ['flights']);
    assert.deepEqual(data.hotels, [{ name: 'Tokyo Station Hotel' }]);
});

test('a slow service gives UPSTREAM_TIMEOUT', async () => {
    const slow = await listen(() => {});
    const gw = await listen(createApp({
        corsOrigins: [], healthPath: '/health', healthTimeoutMs: 500, logRequests: false,
        services: { flight: { url: slow, timeoutMs: 150 } },
    }));
    const res = await fetch(`${gw}/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ flights { id } }' }),
    });
    assert.equal((await res.json()).errors[0].extensions.code, 'UPSTREAM_TIMEOUT');
});

test('GraphQL responses carry the gateway request ID and CORS headers', async () => {
    const res = await fetch(`${gateway}/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', 'X-Request-Id': 'gql-1' },
        body: JSON.stringify({ query: '{ __typename }' }),
    });
    assert.equal(res.headers.get('x-request-id'), 'gql-1');
    assert.equal(res.headers.get('access-control-allow-origin'), null); // corsOrigins is empty in this test config
});

test('login: returns the token and the full profile (re-read with the new token)', async () => {
    seen.length = 0;
    const { data, errors } = await gql(
        `mutation { login(email: "alice@example.com", password: "Password123!") {
            token user { name email languageSettings { timezone } travelPreferences { budgetLevel travelStyles } } } }`,
        { auth: false });
    assert.equal(errors, undefined);
    assert.equal(data.login.token, token);
    assert.deepEqual(data.login.user, {
        name: 'Alice Chen', email: 'alice@example.com',
        languageSettings: { timezone: 'America/Los_Angeles' },
        travelPreferences: { budgetLevel: 'MODERATE', travelStyles: ['FOOD'] },
    });
    assert.equal(seen.find((r) => r.url === '/api/users/me').authorization, `Bearer ${token}`);
});

test('login with a wrong password is UNAUTHENTICATED, with the REST status', async () => {
    const { data, errors } = await gql(
        'mutation { login(email: "alice@example.com", password: "nope") { token } }', { auth: false });
    assert.equal(data, null);
    assert.equal(errors[0].extensions.code, 'UNAUTHENTICATED');
    assert.equal(errors[0].extensions.status, 401);
});

test('loginWithGoogle passes the Google credential to the user service', async () => {
    const ok = await gql('mutation { loginWithGoogle(credential: "google-ok") { token user { email } } }', { auth: false });
    assert.equal(ok.errors, undefined);
    assert.equal(ok.data.loginWithGoogle.user.email, 'alice@example.com');

    const bad = await gql('mutation { loginWithGoogle(credential: "forged") { token } }', { auth: false });
    assert.equal(bad.errors[0].extensions.code, 'UNAUTHENTICATED');
});

test('me is the signed-in user, or null when signed out', async () => {
    assert.equal((await gql('{ me { name } }')).data.me.name, 'Alice Chen');
    const signedOut = await gql('{ me { name } myTravelPreferences { budgetLevel } }', { auth: false });
    assert.equal(signedOut.errors, undefined);
    assert.deepEqual(signedOut.data, { me: null, myTravelPreferences: null });
});

test('a profile update forwards the token and shows validation details', async () => {
    const ok = await gql('mutation { updateBasicInfo(input: { country: "Japan" }) { country } }');
    assert.equal(ok.data.updateBasicInfo.country, 'Japan');

    const bad = await gql('mutation { updateBasicInfo(input: { phone: "call me" }) { country } }');
    assert.equal(bad.errors[0].extensions.code, 'BAD_USER_INPUT');
    assert.deepEqual(bad.errors[0].extensions.details, ['phone must be a phone number']);

    const anon = await gql('mutation { updateBasicInfo(input: { country: "Japan" }) { country } }', { auth: false });
    assert.equal(anon.errors[0].extensions.code, 'UNAUTHENTICATED');
});

test('deleteMe returns true once the user service answers 204', async () => {
    assert.equal((await gql('mutation { deleteMe }')).data.deleteMe, true);
});

test('trips are checked through the user service: a bad token never reaches the Trip Service', async () => {
    seen.length = 0;
    const res = await fetch(`${gateway}/api/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer forged' },
        body: JSON.stringify({ query: '{ myTrips { id } }' }),
    });
    const { data, errors } = await res.json();
    assert.equal(data, null);
    assert.equal(errors[0].extensions.code, 'UNAUTHENTICATED');
    assert.equal(seen.filter((r) => r.service === 'trip').length, 0);
});

test('a query that does not fit the schema is HTTP 400; a failing field stays 200', async () => {
    const bad = await fetch(`${gateway}/api/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ me { nope } }' }),
    });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).errors[0].extensions.code, 'GRAPHQL_VALIDATION_FAILED');

    const failed = await fetch(`${gateway}/api/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'mutation { login(email: "a@b.co", password: "nope") { token } }' }),
    });
    assert.equal(failed.status, 200);
});

// ---------- Trips, itineraries, places and advice ----------

const tripCalls = () => seen.filter((r) => r.service === 'trip');

test('trip details in one query: flights, days, and the places of a day', async () => {
    seen.length = 0;
    const { data, errors } = await gql(`{
        trip(id: 1) { id ownerId title flights { id flightNumber departAt price } itineraries { dayNumber date placeCount } }
        itineraryDay(tripId: 1, dayNumber: 1) { date items { id position place { name city lat } } }
    }`);
    assert.equal(errors, undefined);
    assert.equal(data.trip.ownerId, '7');
    assert.deepEqual(data.trip.flights, [{ id: '3', flightNumber: 'NH 177', departAt: '2027-01-28T19:40:00.000Z', price: 912 }]);
    assert.deepEqual(data.trip.itineraries, [{ dayNumber: 1, date: '2027-01-28', placeCount: 1 }]);
    assert.deepEqual(data.itineraryDay.items, [{ id: '9', position: 2, place: { name: 'Senso-ji Temple', city: 'Tokyo', lat: 35.71 } }]);
    assert.ok(tripCalls().every((r) => r.userId === '7'));
});

test('myTrips has flights too (read when asked for) and a missing day is null', async () => {
    const { data, errors } = await gql('{ myTrips(status: upcoming) { title flights { airline } } itineraryDay(tripId: 1, dayNumber: 2) { date } }');
    assert.equal(errors, undefined);
    assert.equal(data.myTrips[0].flights[0].airline, 'ANA');
    assert.equal(data.itineraryDay, null);
});

test('createTrip: sends the validated user, converts the flight id, and lists validation problems', async () => {
    seen.length = 0;
    const input = '{ title: "Japan Trip", destination: "Tokyo", startDate: "2027-01-28", endDate: "2027-02-03", flightId: "4" }';
    const ok = await gql(`mutation { createTrip(input: ${input}) { title flights { id } } }`);
    assert.equal(ok.errors, undefined);
    assert.equal(ok.data.createTrip.flights.length, 1);
    const call = tripCalls().find((r) => r.method === 'POST');
    assert.equal(call.userId, '7');
    assert.equal(call.body.flightId, 4); // a number, as the Trip Service requires

    const bad = await gql('mutation { createTrip(input: { title: "", destination: "T", startDate: "2027-01-28", endDate: "2027-02-03" }) { id } }');
    assert.equal(bad.errors[0].extensions.code, 'BAD_USER_INPUT');
    assert.deepEqual(bad.errors[0].extensions.details, ['title is required and must be a non-empty string']);

    const anon = await gql('mutation { createTrip(input: { title: "x", destination: "T", startDate: "2027-01-28", endDate: "2027-02-03" }) { id } }', { auth: false });
    assert.equal(anon.errors[0].extensions.code, 'UNAUTHENTICATED');
});

test('updateTrip, deleteTrip: conflict, not found and success', async () => {
    const ok = await gql('mutation { updateTrip(id: 1, input: { title: "New", destination: "Tokyo", startDate: "2027-01-28", endDate: "2027-02-03" }) { title } }');
    assert.equal(ok.data.updateTrip.title, 'New');

    const conflict = await gql('mutation { updateTrip(id: 1, input: { title: "New", destination: "Tokyo", startDate: "2027-01-28", endDate: "2027-01-29" }) { title } }');
    assert.equal(conflict.errors[0].extensions.code, 'CONFLICT');
    assert.deepEqual(conflict.errors[0].extensions.details, ['Day 7 has places; remove them first']);

    const missing = await gql('mutation { updateTrip(id: 99, input: { title: "New", destination: "Tokyo", startDate: "2027-01-28", endDate: "2027-02-03" }) { title } }');
    assert.equal(missing.errors[0].extensions.code, 'NOT_FOUND');
    assert.equal(missing.errors[0].extensions.status, 404);

    assert.equal((await gql('mutation { deleteTrip(id: 1) }')).data.deleteTrip, true);
    assert.equal((await gql('mutation { deleteTrip(id: 99) }')).errors[0].extensions.code, 'NOT_FOUND');
    assert.equal((await gql('mutation { deleteTrip(id: 1) }', { auth: false })).errors[0].extensions.code, 'UNAUTHENTICATED');
});

test('attachFlight / detachFlight', async () => {
    seen.length = 0;
    const ok = await gql('mutation { attachFlight(tripId: 1, flightId: "4") { id flightId airline } }');
    assert.deepEqual(ok.data.attachFlight, { id: '3', flightId: '4', airline: 'ANA' });
    assert.equal(tripCalls().find((r) => r.method === 'POST').body.flightId, 4);

    const dup = await gql('mutation { attachFlight(tripId: 1, flightId: 5) { id } }');
    assert.equal(dup.errors[0].extensions.code, 'CONFLICT');

    assert.equal((await gql('mutation { detachFlight(tripId: 1, tripFlightId: 3) }')).data.detachFlight, true);
    assert.equal((await gql('mutation { detachFlight(tripId: 1, tripFlightId: 4) }')).errors[0].extensions.code, 'NOT_FOUND');
    assert.equal((await gql('mutation { detachFlight(tripId: 1, tripFlightId: 3) }', { auth: false })).errors[0].extensions.code, 'UNAUTHENTICATED');
});

test('itinerary items: add (sample or Google place), reorder, remove', async () => {
    seen.length = 0;
    const added = await gql('mutation { addItineraryItem(tripId: 1, dayNumber: 1, input: { placeId: "5", position: 2 }) { id position place { name } } }');
    assert.equal(added.errors, undefined);
    assert.equal(added.data.addItineraryItem.place.name, 'Senso-ji Temple');
    const post = tripCalls().find((r) => r.method === 'POST');
    assert.deepEqual(post.body, { placeId: 5, position: 2 }); // nulls are not sent

    seen.length = 0;
    await gql('mutation { addItineraryItem(tripId: 1, dayNumber: 1, input: { googlePlaceId: "ChIJabc", language: "en" }) { id } }');
    assert.deepEqual(tripCalls().find((r) => r.method === 'POST').body, { googlePlaceId: 'ChIJabc', language: 'en' });

    const both = await gql('mutation { addItineraryItem(tripId: 1, dayNumber: 1, input: { placeId: 5, googlePlaceId: "ChIJabc" }) { id } }');
    assert.equal(both.errors[0].extensions.code, 'BAD_USER_INPUT');

    const reordered = await gql('mutation { reorderItineraryItems(tripId: 1, dayNumber: 1, itemIds: ["8", "9"]) { placeCount items { id position } } }');
    assert.deepEqual(reordered.data.reorderItineraryItems, { placeCount: 2, items: [{ id: '8', position: 1 }, { id: '9', position: 2 }] });
    assert.deepEqual(tripCalls().find((r) => r.method === 'PUT').body, { itemIds: [8, 9] });

    assert.equal((await gql('mutation { removeItineraryItem(tripId: 1, dayNumber: 1, itemId: 9) }')).data.removeItineraryItem, true);
    assert.equal((await gql('mutation { removeItineraryItem(tripId: 1, dayNumber: 1, itemId: 10) }')).errors[0].extensions.code, 'NOT_FOUND');
    const anon = await gql('mutation { removeItineraryItem(tripId: 1, dayNumber: 1, itemId: 9) }', { auth: false });
    assert.equal(anon.errors[0].extensions.code, 'UNAUTHENTICATED');
});

test('places: catalog, config, nearby and locate (null when Google finds nothing)', async () => {
    seen.length = 0;
    const { data, errors } = await gql(`{
        places(city: "Tokyo", category: attraction) { id name category }
        placesConfig { googlePlaces }
        nearbyPlaces(lat: 35.7, lng: 139.7, radius: 1500, category: food) { googlePlaceId name type rating ratingCount }
        locatePlace(query: "Tokyo") { name viewport { north west } }
        nowhere: locatePlace(query: "Atlantis") { name }
    }`);
    assert.equal(errors, undefined);
    assert.deepEqual(data.places, [{ id: '5', name: 'Senso-ji Temple', category: 'attraction' }]);
    assert.equal(data.placesConfig.googlePlaces, true);
    assert.deepEqual(data.nearbyPlaces[0], { googlePlaceId: 'ChIJabc', name: 'Ichiran', type: 'Ramen restaurant', rating: 4.5, ratingCount: 1200 });
    assert.deepEqual(data.locatePlace, { name: 'Tokyo', viewport: { north: 36, west: 139 } });
    assert.equal(data.nowhere, null);
    const nearby = new URL(tripCalls().find((r) => r.url.startsWith('/api/places/nearby')).url, 'http://x');
    assert.equal(nearby.searchParams.get('radius'), '1500');
    assert.equal(nearby.searchParams.get('category'), 'food');

    const anon = await gql('{ places { id } }', { auth: false });
    assert.equal(anon.errors[0].extensions.code, 'UNAUTHENTICATED');
});

test('tripNotes: the LLM service gets the trip id, the user id from the user service and the caller token', async () => {
    seen.length = 0;
    const { data, errors } = await gql('{ tripNotes(tripId: 1) { tripId destination startDate source generatedAt notes { category priority title day itemId } } }');
    assert.equal(errors, undefined);
    assert.deepEqual(data.tripNotes.notes, [{ category: 'itinerary', priority: 'high', title: 'Too early', day: 1, itemId: '9' }]);
    assert.equal(data.tripNotes.tripId, '1');
    assert.equal(data.tripNotes.startDate, '2027-01-28');
    const call = seen.find((r) => r.service === 'llm');
    assert.deepEqual(call.body, { trip_id: 1 });
    assert.equal(call.userId, '7');
    assert.equal(call.authorization, `Bearer ${token}`);

    const missing = await gql('{ tripNotes(tripId: 99) { tripId } }');
    assert.equal(missing.errors[0].extensions.code, 'NOT_FOUND');
    const anon = await gql('{ tripNotes(tripId: 1) { tripId } }', { auth: false });
    assert.equal(anon.errors[0].extensions.code, 'UNAUTHENTICATED');
});

test('advice: the user id comes from the user service, never from the client', async () => {
    seen.length = 0;
    const list = await gql('{ myAdvice(tripId: 1, limit: 5) { id tripId topic prompt content source createdAt } }');
    assert.equal(list.errors, undefined);
    assert.deepEqual(list.data.myAdvice, [{ id: '1', tripId: '1', topic: 'packing', prompt: 'What to pack?', content: 'Layers.',
        source: 'user', createdAt: '2026-11-06T18:00:00.000Z' }]);
    const listCall = new URL(seen.find((r) => r.service === 'llm').url, 'http://x');
    assert.equal(listCall.searchParams.get('userId'), '7');
    assert.equal(listCall.searchParams.get('tripId'), '1');
    assert.equal(listCall.searchParams.get('sort'), 'created_at');
    assert.equal(listCall.searchParams.get('order'), 'desc');
    assert.equal(listCall.searchParams.get('limit'), '5');

    seen.length = 0;
    const asked = await gql('mutation { askAdvice(tripId: 1, topic: packing, prompt: "What to pack?") { id content source tripId } }');
    assert.equal(asked.errors, undefined);
    assert.deepEqual(asked.data.askAdvice, { id: '2', content: 'Pack layers.', source: 'stub', tripId: '1' });
    assert.deepEqual(seen.find((r) => r.service === 'llm').body, { user_id: '7', trip_id: 1, topic: 'packing', prompt: 'What to pack?' });

    // The schema has no way to pass a user id at all
    const forged = await gql('mutation { askAdvice(userId: "99", prompt: "x") { id } }');
    assert.equal(forged.errors[0].extensions.code, 'GRAPHQL_VALIDATION_FAILED');

    seen.length = 0;
    for (const query of ['{ myAdvice { id } }', 'mutation { askAdvice(prompt: "x") { id } }']) {
        const anon = await gql(query, { auth: false });
        assert.equal(anon.errors[0].extensions.code, 'UNAUTHENTICATED', query);
    }
    assert.equal(seen.filter((r) => r.service === 'llm').length, 0);
});
