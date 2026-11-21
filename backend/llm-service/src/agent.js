// The AI Travel Assistant as a tool-calling chain: the model decides whether and how to call
// search_flights, sees the results, and decides what to do next, up to a fixed number of calls.
// The tool only reads (it searches the flight service); nothing is booked or added to a trip here.
// Adding a found flight to a trip is a separate step the user confirms in the app.

const MAX_TOOL_CALLS = Number(process.env.AGENT_MAX_TOOL_CALLS) || 2;
const TIME_BUDGET_MS = Number(process.env.AGENT_TIME_BUDGET_MS) || 45000; // stays inside the gateway's limit
const FLIGHT_TIMEOUT_MS = Number(process.env.AGENT_FLIGHT_TIMEOUT_MS) || 18000; // a live search may retry once
const MAX_FLIGHTS_SHOWN = 5;
const FLIGHTS_PER_RESULT = 8;

const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'search_flights',
            description:
                'Search one-way flights (1 adult, USD) between two airports. With a date in the future the results are ' +
                'live from Google Flights; without a date only our small stored catalog is searched. Cheapest first.',
            parameters: {
                type: 'object',
                properties: {
                    origin: { type: 'string', description: '3-letter IATA code of the departure airport, e.g. SEA' },
                    destination: { type: 'string', description: '3-letter IATA code of the arrival airport, e.g. NRT' },
                    departDate: { type: 'string', description: 'Departure date, YYYY-MM-DD (strongly recommended)' },
                    maxPrice: { type: 'number', description: 'Highest price in USD (optional)' },
                },
                required: ['origin', 'destination'],
            },
        },
    },
];

const systemPrompt = (today) =>
    'You are a friendly travel assistant inside a trip-planning app. Answer in under 150 words with practical, ' +
    `specific tips. Today is ${today}.\n` +
    'When the traveler asks about flights, call search_flights. Convert cities to IATA airport codes yourself ' +
    '(e.g. Tokyo -> NRT or HND, Taipei -> TPE) and dates to YYYY-MM-DD. You may search at most ' +
    `${MAX_TOOL_CALLS} times, so choose carefully.\n` +
    'Only mention flights, times and prices that appear in search results; never invent them. Times in results ' +
    'are local to each airport in 24-hour format (e.g. 12:00 is noon): copy them as given and do not add AM or PM. The app shows the ' +
    'flights it found as cards with an "Add to Trip" button, so refer to them by airline, flight number and price. ' +
    'If a search finds nothing or fails, say so and suggest another date or airport. Do not invent hotel or ' +
    'activity prices, opening hours or booking details.';

const AIRPORT = /^[A-Za-z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// The model's arguments, checked before anything is called with them.
function readArgs(raw) {
    let args;
    try {
        args = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {};
    } catch {
        return { error: 'arguments are not valid JSON' };
    }
    const origin = String(args.origin || '').trim();
    const destination = String(args.destination || '').trim();
    if (!AIRPORT.test(origin) || !AIRPORT.test(destination)) return { error: 'origin and destination must be 3-letter IATA codes' };
    const query = { origin: origin.toUpperCase(), destination: destination.toUpperCase(), sort: 'price', order: 'asc', limit: String(FLIGHTS_PER_RESULT) };
    if (args.departDate !== undefined && args.departDate !== null && args.departDate !== '') {
        if (!DATE.test(String(args.departDate))) return { error: 'departDate must be YYYY-MM-DD' };
        query.departDate = String(args.departDate);
    }
    if (args.maxPrice !== undefined && args.maxPrice !== null) {
        const price = Number(args.maxPrice);
        if (!Number.isFinite(price) || price <= 0) return { error: 'maxPrice must be a positive number' };
        query.maxPrice = String(price);
    }
    return { query };
}

// What the model sees of a flight: enough to choose and explain, nothing more.
const forModel = (f) => ({
    id: f.id,
    airline: f.airline,
    flight_number: f.flight_number,
    from: f.origin,
    to: f.destination,
    departs: f.depart_local || f.depart_at,
    arrives: f.arrive_local || f.arrive_at,
    stops: f.stops ?? 0,
    price_usd: Number(f.price),
});

async function searchFlights(query, { flightServiceUrl, fetchImpl, timeoutMs }) {
    const url = new URL('/api/flights', flightServiceUrl);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    let res;
    try {
        res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
        return { error: err.name === 'TimeoutError' ? 'flight search timed out' : 'flight service unavailable' };
    }
    if (!res.ok) return { error: `flight service answered ${res.status}` };
    const body = await res.json();
    const source = typeof res.headers?.get === 'function' ? res.headers.get('X-Flight-Source') : null;
    return { flights: body.data || [], source };
}

const describe = (query) =>
    `${query.origin} → ${query.destination}${query.departDate ? ` on ${query.departDate}` : ''}${query.maxPrice ? ` under $${query.maxPrice}` : ''}`;

// Runs the chain. complete(params) calls the model and returns its message ({ content, tool_calls }).
// Resolves with { content, steps, flights } (flights: full rows, cheapest first, for the app's cards).
async function runAgent({ prompt, complete, flightServiceUrl, fetchImpl = fetch, now = () => new Date(), log = console }) {
    const started = Date.now();
    const today = now().toISOString().slice(0, 10);
    const messages = [
        { role: 'system', content: systemPrompt(today) },
        { role: 'user', content: prompt },
    ];
    const steps = [];
    const found = new Map(); // flight id -> row
    let callsLeft = MAX_TOOL_CALLS;

    // At most one model turn per allowed call, plus the final answer.
    for (let turn = 0; turn <= MAX_TOOL_CALLS; turn += 1) {
        const canSearch = callsLeft > 0 && Date.now() - started < TIME_BUDGET_MS - FLIGHT_TIMEOUT_MS;
        const message = await complete({ messages, tools: TOOLS, tool_choice: canSearch ? 'auto' : 'none' });
        const calls = message.tool_calls || [];
        if (!calls.length) {
            const content = (message.content || '').trim();
            const flights = [...found.values()].sort((a, b) => Number(a.price) - Number(b.price)).slice(0, MAX_FLIGHTS_SHOWN);
            return { content, steps, flights };
        }

        messages.push({ role: 'assistant', content: message.content || '', tool_calls: calls });
        for (const call of calls) {
            let result;
            if (call.function?.name !== 'search_flights') {
                result = { error: `unknown tool ${call.function?.name}` };
            } else if (callsLeft <= 0) {
                // The cap: the call is answered, but not run.
                result = { error: `search limit reached (${MAX_TOOL_CALLS} per question); answer with what you have` };
                steps.push({ tool: 'search_flights', summary: 'Search skipped: limit reached', count: 0 });
            } else {
                const { query, error } = readArgs(call.function.arguments);
                if (error) {
                    result = { error };
                    steps.push({ tool: 'search_flights', summary: `Search not run: ${error}`, count: 0 });
                } else {
                    callsLeft -= 1;
                    const outcome = await searchFlights(query, { flightServiceUrl, fetchImpl, timeoutMs: FLIGHT_TIMEOUT_MS });
                    if (outcome.error) {
                        result = { error: outcome.error };
                        steps.push({ tool: 'search_flights', summary: `Searched flights ${describe(query)}: ${outcome.error}`, count: 0 });
                    } else {
                        for (const f of outcome.flights) found.set(f.id, f);
                        const live = outcome.source === 'live' || outcome.source === 'live-cached';
                        result = { source: live ? 'Google Flights (live)' : 'stored catalog', flights: outcome.flights.map(forModel) };
                        steps.push({
                            tool: 'search_flights',
                            summary: `Searched flights ${describe(query)}${live ? ' (live)' : ''}: ${outcome.flights.length} found`,
                            count: outcome.flights.length,
                        });
                    }
                    log.log(`[agent] search_flights ${describe(query)} -> ${result.error || `${result.flights.length} flights`}`);
                }
            }
            messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        }
    }
    // The model kept asking for tools after its last allowed turn.
    throw new Error('the model did not give an answer within the call limit');
}

module.exports = { runAgent, readArgs, TOOLS, MAX_TOOL_CALLS };
