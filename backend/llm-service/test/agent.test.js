// The tool-calling chain with a scripted fake model and a fake flight service (no network, no key).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAgent, readArgs, MAX_TOOL_CALLS } = require('../src/agent');
const { generateAdvice } = require('../src/llm');

const quiet = { log() {}, warn() {}, error() {} };
const NOW = () => new Date('2026-11-21T12:00:00Z');

const FLIGHTS = [
    { id: 41, airline: 'Alaska', flight_number: 'AS 123', origin: 'SEA', destination: 'NRT', depart_at: '2026-12-25T19:55:00Z',
      arrive_at: '2026-12-26T06:25:00Z', depart_local: '2026-12-25 11:55', arrive_local: '2026-12-26 15:25', stops: 0, price: '802.00', source: 'serpapi' },
    { id: 42, airline: 'Alaska', flight_number: 'AS 2262', origin: 'SEA', destination: 'NRT', depart_at: '2026-12-25T18:03:00Z',
      arrive_at: '2026-12-26T07:00:00Z', depart_local: '2026-12-25 10:03', arrive_local: '2026-12-26 16:00', stops: 1, price: '578.00', source: 'serpapi' },
];

// A fake model that plays back the given replies and records what it was sent.
function scriptedModel(replies) {
    const sent = [];
    const complete = async (params) => {
        sent.push(JSON.parse(JSON.stringify(params)));
        return replies.shift() || { content: 'done' };
    };
    return { complete, sent };
}

const toolCall = (id, args) => ({ id, type: 'function', function: { name: 'search_flights', arguments: JSON.stringify(args) } });

// A fake flight service answering GET /api/flights.
function fakeFlightService({ flights = FLIGHTS, status = 200, source = 'live' } = {}) {
    const urls = [];
    const fetchImpl = async (url) => {
        urls.push(new URL(url));
        return { ok: status < 300, status, headers: { get: (h) => (h === 'X-Flight-Source' ? source : null) }, json: async () => ({ data: flights }) };
    };
    return { fetchImpl, urls };
}

test('the model searches once, then answers; the flights come back cheapest first', async () => {
    const model = scriptedModel([
        { content: '', tool_calls: [toolCall('c1', { origin: 'sea', destination: 'NRT', departDate: '2026-12-25' })] },
        { content: 'The cheapest is Alaska AS 2262 at $578 with one stop.' },
    ]);
    const service = fakeFlightService();
    const result = await runAgent({ prompt: 'Cheapest flight Seattle to Tokyo on Dec 25?', complete: model.complete, flightServiceUrl: 'http://flights:3004', fetchImpl: service.fetchImpl, now: NOW, log: quiet });

    assert.equal(result.content, 'The cheapest is Alaska AS 2262 at $578 with one stop.');
    assert.deepEqual(result.flights.map((f) => f.id), [42, 41]);
    assert.equal(result.steps.length, 1);
    assert.match(result.steps[0].summary, /SEA → NRT on 2026-12-25 \(live\): 2 found/);

    // The search used the model's arguments, upper-cased and sorted by price.
    const url = service.urls[0];
    assert.equal(url.pathname, '/api/flights');
    assert.equal(url.searchParams.get('origin'), 'SEA');
    assert.equal(url.searchParams.get('departDate'), '2026-12-25');
    assert.equal(url.searchParams.get('sort'), 'price');

    // The model was told today's date, and the tool result it saw has real prices only.
    assert.match(model.sent[0].messages[0].content, /Today is 2026-11-21/);
    const toolMessage = model.sent[1].messages.find((m) => m.role === 'tool');
    assert.equal(JSON.parse(toolMessage.content).flights[0].price_usd, 802);
});

test(`the cap: after ${MAX_TOOL_CALLS} searches the model must answer`, async () => {
    const model = scriptedModel([
        { content: '', tool_calls: [toolCall('c1', { origin: 'SEA', destination: 'NRT', departDate: '2026-12-25' })] },
        { content: '', tool_calls: [toolCall('c2', { origin: 'SEA', destination: 'HND', departDate: '2026-12-25' }), toolCall('c3', { origin: 'SEA', destination: 'KIX', departDate: '2026-12-25' })] },
        { content: 'Here is what I found.' },
    ]);
    const service = fakeFlightService();
    const result = await runAgent({ prompt: 'Compare Tokyo airports', complete: model.complete, flightServiceUrl: 'http://flights:3004', fetchImpl: service.fetchImpl, now: NOW, log: quiet });

    assert.equal(service.urls.length, MAX_TOOL_CALLS); // the third search was not run
    assert.match(result.steps.at(-1).summary, /limit reached/);
    // On its last turn the model is not allowed to call tools.
    assert.equal(model.sent.at(-1).tool_choice, 'none');
    assert.equal(result.content, 'Here is what I found.');
});

test('a failed search is passed to the model, which explains it', async () => {
    const model = scriptedModel([
        { content: '', tool_calls: [toolCall('c1', { origin: 'SEA', destination: 'NRT', departDate: '2026-12-25' })] },
        { content: 'Flight search is unavailable right now.' },
    ]);
    const service = fakeFlightService({ status: 502 });
    const result = await runAgent({ prompt: 'Flights?', complete: model.complete, flightServiceUrl: 'http://flights:3004', fetchImpl: service.fetchImpl, now: NOW, log: quiet });

    const toolMessage = model.sent[1].messages.find((m) => m.role === 'tool');
    assert.match(JSON.parse(toolMessage.content).error, /502/);
    assert.equal(result.flights.length, 0);
    assert.match(result.steps[0].summary, /502/);
});

test('bad arguments from the model are rejected before any search', async () => {
    assert.match(readArgs('{"origin":"Seattle","destination":"NRT"}').error, /IATA/);
    assert.match(readArgs('{"origin":"SEA","destination":"NRT","departDate":"Dec 25"}').error, /YYYY-MM-DD/);
    assert.match(readArgs('not json').error, /JSON/);
    assert.deepEqual(readArgs('{"origin":"sea","destination":"nrt","maxPrice":700}').query.maxPrice, '700');
});

test('an answer with no flight question uses no tools', async () => {
    const model = scriptedModel([{ content: 'Pack layers for Tokyo in winter.' }]);
    const service = fakeFlightService();
    const result = await runAgent({ prompt: 'What to pack for Tokyo?', complete: model.complete, flightServiceUrl: 'http://flights:3004', fetchImpl: service.fetchImpl, now: NOW, log: quiet });
    assert.equal(service.urls.length, 0);
    assert.deepEqual(result.steps, []);
    assert.equal(model.sent[0].tool_choice, 'auto');
});

test('generateAdvice saves the steps and flights as JSON with the answer', async () => {
    const model = scriptedModel([
        { content: '', tool_calls: [toolCall('c1', { origin: 'SEA', destination: 'NRT', departDate: '2026-12-25' })] },
        { content: 'Try AS 2262.' },
    ]);
    const service = fakeFlightService();
    const advice = await generateAdvice({ topic: 'general', prompt: 'Flights to Tokyo?' }, { complete: model.complete, fetchImpl: service.fetchImpl });
    assert.equal(advice.source, 'llm');
    assert.equal(JSON.parse(advice.flights)[0].flight_number, 'AS 2262');
    assert.equal(JSON.parse(advice.tool_steps)[0].tool, 'search_flights');
});
