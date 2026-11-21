// Live one-way flight search through SerpApi's Google Flights engine.
// Docs: https://serpapi.com/google-flights-api
//
// Each attempt has a timeout, and timeouts, network errors, 5xx and 429 are retried once after a
// short pause. Other errors (bad request, invalid key) are not retried: trying again would not help.

const { HttpError } = require('./errors');
const { toUtc } = require('./timezones');

const ENDPOINT = 'https://serpapi.com/search';
const MAX_RESULTS = 40;

const settings = () => ({
    apiKey: process.env.SERPAPI_API_KEY || '',
    timeoutMs: Number(process.env.SERPAPI_TIMEOUT_MS) || 8000,
    retries: process.env.SERPAPI_RETRIES === undefined ? 1 : Number(process.env.SERPAPI_RETRIES),
    retryDelayMs: Number(process.env.SERPAPI_RETRY_DELAY_MS) || 500,
});

const isConfigured = () => Boolean(settings().apiKey);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Whether a failed attempt is worth repeating.
const retryable = (err) => err.retryable === true;

async function attempt(url, timeoutMs) {
    let res;
    try {
        res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
        const timedOut = err.name === 'TimeoutError';
        throw Object.assign(new Error(timedOut ? `SerpApi did not answer within ${timeoutMs} ms` : 'SerpApi could not be reached'), {
            retryable: true,
            reason: timedOut ? 'timeout' : 'unreachable',
        });
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw Object.assign(new Error(`SerpApi answered ${res.status}: ${body.error || 'no details'}`), {
            retryable: res.status === 429 || res.status >= 500,
            reason: res.status === 401 ? 'invalid key' : res.status === 429 ? 'quota or rate limit' : `HTTP ${res.status}`,
        });
    }
    // A search can succeed with no flights; SerpApi then puts a message in "error".
    if (body.search_metadata?.status === 'Error') {
        throw Object.assign(new Error(`SerpApi search failed: ${body.error || 'no details'}`), { retryable: true, reason: 'search failed' });
    }
    return body;
}

// Calls SerpApi with retries. Resolves with { body, attempts }, or rejects with an error that
// carries .reason (short, safe to show) and .attempts.
async function callWithRetry(url, { timeoutMs, retries, retryDelayMs }, log = console) {
    let lastError;
    for (let n = 1; n <= retries + 1; n += 1) {
        try {
            const body = await attempt(url, timeoutMs);
            if (n > 1) log.log(`[serpapi] attempt ${n} succeeded`);
            return { body, attempts: n };
        } catch (err) {
            err.attempts = n;
            lastError = err;
            log.warn(`[serpapi] attempt ${n} failed: ${err.message}`);
            if (!retryable(err) || n > retries) break;
            await sleep(retryDelayMs * n);
        }
    }
    throw lastError;
}

// One SerpApi flight option (one or more legs) -> one row for the flights table.
function toRow(option) {
    const legs = option.flights || [];
    if (!legs.length || typeof option.price !== 'number') return null;
    const first = legs[0];
    const last = legs[legs.length - 1];
    const departLocal = first.departure_airport?.time;
    const arriveLocal = last.arrival_airport?.time;
    const origin = first.departure_airport?.id;
    const destination = last.arrival_airport?.id;
    if (!departLocal || !arriveLocal || !origin || !destination) return null;

    // Times are local to each airport. Convert with the airport's time zone; if only one end is known,
    // work out the other from the total duration.
    const minutes = option.total_duration || legs.reduce((sum, leg) => sum + (leg.duration || 0), 0);
    let departAt = toUtc(departLocal, origin);
    let arriveAt = toUtc(arriveLocal, destination);
    if (!departAt && arriveAt) departAt = new Date(arriveAt.getTime() - minutes * 60000);
    if (departAt && !arriveAt) arriveAt = new Date(departAt.getTime() + minutes * 60000);
    if (!departAt || !arriveAt) return null;

    const flightNumbers = legs.map((leg) => leg.flight_number).filter(Boolean);
    return {
        airline: first.airline || 'Unknown airline',
        flight_number: (first.flight_number || 'N/A').slice(0, 10),
        origin: origin.slice(0, 3),
        destination: destination.slice(0, 3),
        depart_at: departAt.toISOString(),
        arrive_at: arriveAt.toISOString(),
        depart_local: departLocal,
        arrive_local: arriveLocal,
        price: option.price,
        currency: 'USD',
        seats_available: null, // Google Flights does not say
        stops: legs.length - 1,
        source: 'serpapi',
        // The same itinerary found again updates its row instead of adding a copy.
        external_key: `${flightNumbers.join('+') || first.airline}@${origin}:${departLocal}`.slice(0, 300),
    };
}

// Searches one-way flights. Resolves with { rows, attempts }.
async function searchOneWay({ origin, destination, date }, log = console) {
    const config = settings();
    if (!config.apiKey) throw new HttpError(503, 'SERPAPI_NOT_CONFIGURED', 'SERPAPI_API_KEY is not set');

    const params = new URLSearchParams({
        engine: 'google_flights',
        departure_id: origin.toUpperCase(),
        arrival_id: destination.toUpperCase(),
        outbound_date: date,
        type: '2', // one way
        currency: 'USD',
        hl: 'en',
        adults: '1',
        api_key: config.apiKey,
    });
    const { body, attempts } = await callWithRetry(`${ENDPOINT}?${params}`, config, log);
    const options = [...(body.best_flights || []), ...(body.other_flights || [])].slice(0, MAX_RESULTS);
    return { rows: options.map(toRow).filter(Boolean), attempts };
}

module.exports = { isConfigured, searchOneWay, toRow, callWithRetry };
