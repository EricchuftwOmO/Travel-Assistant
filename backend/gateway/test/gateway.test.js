// Gateway tests: stub services on random ports, requests sent through the gateway.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createHmac } = require('node:crypto');
const { createApp } = require('../src/app');

const SECRET = 'test-secret';

function makeToken(payload, secret = SECRET) {
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const head = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}`;
    return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
}
const goodToken = makeToken({ userId: 7, exp: Math.floor(Date.now() / 1000) + 3600 });

const rawFetch = fetch;
const fetchAs = (url, opts = {}) =>
    rawFetch(url, { ...opts, headers: { Authorization: `Bearer ${goodToken}`, ...opts.headers } });

const servers = [];

function listen(handler) {
    return new Promise((resolve) => {
        const server = http.createServer(handler);
        server.listen(0, '127.0.0.1', () => {
            servers.push(server);
            resolve(`http://127.0.0.1:${server.address().port}`);
        });
    });
}

function echoService(name) {
    return listen((req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end('{"status":"ok"}');
        }
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ service: name, method: req.method, url: req.url, headers: req.headers, body }));
        });
    });
}

async function deadUrl() {
    const url = await listen(() => {});
    const server = servers.pop();
    await new Promise((resolve) => server.close(resolve));
    return url;
}

let gateway;

before(async () => {
    const config = {
        corsOrigins: ['http://localhost:5173'],
        healthPath: '/health',
        healthTimeoutMs: 500,
        logRequests: false,
        jwtSecret: SECRET,
        services: {
            trip: { url: await echoService('trip'), timeoutMs: 1000 },
            search: { url: await echoService('search'), timeoutMs: 1000 },
            budget: { url: await echoService('budget'), timeoutMs: 1000 },
            flight: { url: await echoService('flight'), timeoutMs: 1000 },
            hotel: { url: await echoService('hotel'), timeoutMs: 1000 },
            carRental: { url: await echoService('carRental'), timeoutMs: 1000 },
            llm: { url: await echoService('llm'), timeoutMs: 1000 },
            // The planner is "slow": it never answers, to test the timeout
            planner: { url: await listen(() => {}), timeoutMs: 200 },
        },
    };
    gateway = await listen(createApp(config));
});

after(() => {
    for (const server of servers) server.closeAllConnections();
    return Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
});

test('routes each path to the owning service', async () => {
    const cases = [
        ['/api/trips?userId=1', 'trip'],
        ['/api/trips/1', 'trip'],
        ['/api/trips/1/items', 'trip'],
        ['/api/trips/1/budget', 'budget'],
        ['/api/trips/1/itineraries/2/items', 'trip'],
        ['/api/auth/login', 'trip'],
        ['/api/users/me', 'trip'],
        ['/api/places?city=Tokyo', 'trip'],
        ['/api/activities/search?city=seattle', 'search'],
        ['/api/budget/estimate', 'budget'],
        ['/api/flights?origin=SEA', 'flight'],
        ['/api/flights/3', 'flight'],
        ['/api/hotels?city=Tokyo', 'hotel'],
        ['/api/car-rentals/2', 'carRental'],
        ['/api/activities?city=Seattle', 'search'],
        ['/api/advice?userId=u1', 'llm'],
    ];
    for (const [path, service] of cases) {
        const res = await fetchAs(gateway + path);
        assert.equal(res.status, 200, path);
        const body = await res.json();
        assert.equal(body.service, service, path);
        assert.equal(body.url, path, `${path} should be forwarded unchanged`);
    }
});

test('forwards method and body unchanged', async () => {
    const payload = JSON.stringify({ activityId: 3, day: 1 });
    const res = await fetchAs(`${gateway}/api/trips/1/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
    });
    const body = await res.json();
    assert.equal(body.method, 'POST');
    assert.equal(body.body, payload);
    assert.equal(body.headers['content-type'], 'application/json');
});

test('adds a request ID and forwards it to the service', async () => {
    const res = await fetchAs(`${gateway}/api/trips`);
    const id = res.headers.get('x-request-id');
    assert.match(id, /^[0-9a-f-]{36}$/);
    const body = await res.json();
    assert.equal(body.headers['x-request-id'], id);
});

test('sends the service its own Host and the client details in X-Forwarded-*', async () => {
    const res = await fetchAs(`${gateway}/api/trips`);
    const body = await res.json();
    const gatewayHost = new URL(gateway).host;
    assert.notEqual(body.headers.host, gatewayHost);
    assert.equal(body.headers['x-forwarded-host'], gatewayHost);
    assert.ok(body.headers['x-forwarded-for']);
    assert.equal(body.headers['x-forwarded-proto'], 'http');
});

test('keeps a valid client request ID and replaces an invalid one', async () => {
    let res = await fetchAs(`${gateway}/api/trips`, { headers: { 'X-Request-Id': 'abc-123' } });
    assert.equal(res.headers.get('x-request-id'), 'abc-123');

    res = await fetchAs(`${gateway}/api/trips`, { headers: { 'X-Request-Id': 'bad id with spaces' } });
    assert.notEqual(res.headers.get('x-request-id'), 'bad id with spaces');
});

test('unknown path returns 404 NOT_FOUND', async () => {
    const res = await fetchAs(`${gateway}/api/nope`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'NOT_FOUND');
});

test('service that does not answer returns 504 UPSTREAM_TIMEOUT', async () => {
    const res = await fetchAs(`${gateway}/api/planner/proposals`, { method: 'POST' });
    assert.equal(res.status, 504);
    assert.equal((await res.json()).error.code, 'UPSTREAM_TIMEOUT');
});

test('service that is down returns 502 UPSTREAM_UNAVAILABLE', async () => {
    const config = {
        corsOrigins: [], jwtSecret: SECRET, healthPath: '/health', healthTimeoutMs: 500, logRequests: false,
        services: { trip: { url: await deadUrl(), timeoutMs: 1000 } },
    };
    const downGateway = await listen(createApp(config));

    const res = await fetchAs(`${downGateway}/api/trips`);
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.error.code, 'UPSTREAM_UNAVAILABLE');
    assert.ok(res.headers.get('x-request-id'));
});

test('unconfigured planner is not routed', async () => {
    const config = {
        corsOrigins: [], jwtSecret: SECRET, healthPath: '/health', healthTimeoutMs: 500, logRequests: false,
        services: { planner: { url: '', timeoutMs: 1000 } },
    };
    const noPlanner = await listen(createApp(config));
    const res = await fetchAs(`${noPlanner}/api/planner/proposals`, { method: 'POST' });
    assert.equal(res.status, 404);
});

test('CORS: allowed origin gets headers, preflight answered by the gateway', async () => {
    let res = await fetchAs(`${gateway}/api/trips`, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.match(res.headers.get('access-control-expose-headers'), /X-Total-Count/);

    res = await fetchAs(`${gateway}/api/trips`, { headers: { Origin: 'http://evil.example' } });
    assert.equal(res.headers.get('access-control-allow-origin'), null);

    res = await fetchAs(`${gateway}/api/trips`, {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(res.status, 204);
    assert.match(res.headers.get('access-control-allow-methods'), /POST/);
});

test('combined health check reports each service', async () => {
    // The stub planner never answers, so the gateway reports "degraded"
    const res = await fetchAs(`${gateway}/api/health`);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.status, 'degraded');
    assert.equal(body.services.trip.status, 'up');
    assert.equal(body.services.planner.status, 'down');
    assert.equal(body.services.planner.reason, 'timeout');
});

test('gateway liveness check', async () => {
    const res = await fetchAs(`${gateway}/health`);
    assert.equal(res.status, 200);
});

test('login check: protected routes need a valid token', async () => {
    const noToken = await rawFetch(`${gateway}/api/trips`);
    assert.equal(noToken.status, 401);
    assert.equal(noToken.headers.get('www-authenticate'), 'Bearer');
    assert.equal((await noToken.json()).error.code, 'UNAUTHORIZED');

    const bad = [
        makeToken({ userId: 7, exp: Math.floor(Date.now() / 1000) + 3600 }, 'wrong-secret'),
        makeToken({ userId: 7, exp: Math.floor(Date.now() / 1000) - 10 }),
        makeToken({ userId: 7 }),
        'not.a.jwt',
    ];
    for (const token of bad) {
        const res = await rawFetch(`${gateway}/api/advice`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(res.status, 401, token);
    }
});

test('login check: public routes need no token', async () => {
    for (const [method, path, service] of [
        ['POST', '/api/auth/login', 'trip'],
        ['POST', '/api/auth/register', 'trip'],
        ['GET', '/api/flights?origin=SEA', 'flight'],
        ['GET', '/api/hotels', 'hotel'],
    ]) {
        const res = await rawFetch(gateway + path, { method });
        assert.equal(res.status, 200, path);
        assert.equal((await res.json()).service, service);
    }
    assert.equal((await rawFetch(`${gateway}/api/flights`, { method: 'POST' })).status, 401);
});

test('login check: the gateway sets X-User-Id and drops a forged one', async () => {
    const res = await fetchAs(`${gateway}/api/trips`, { headers: { 'X-User-Id': '999' } });
    assert.equal((await res.json()).headers['x-user-id'], '7');
    const pub = await rawFetch(`${gateway}/api/flights`, { headers: { 'X-User-Id': '999' } });
    assert.equal((await pub.json()).headers['x-user-id'], undefined);
});
