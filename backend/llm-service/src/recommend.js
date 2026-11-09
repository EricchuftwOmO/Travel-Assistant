// TCSS 559 Autumn 2026
// Travel Assistant - LLM Service: trip recommendation summary.
//
//   POST /api/advice/recommendations
//
// The LLM service is the application's AI component. To build a recommendation it
//   1. validates the request,
//   2. calls the Flight, Hotel and Activity services directly (not through the gateway),
//   3. lets the language model choose among the results (or, without a GROQ_API_KEY or if
//      the model's choice is unusable, picks with plain rules),
//   4. adds up the cost IN CODE and checks it against the budget (the model never does the arithmetic),
//   5. saves the summary as advice and returns it with the prices and the ids it used.

const express = require('express');
const Groq = require('groq-sdk');
const { HttpError, badRequest, notFound } = require('./errors');

const MODEL = process.env.LLM_MODEL || 'openai/gpt-oss-20b';
const MAX_ACTIVITIES = 3;
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS) || 5000;

// City name -> airports, so "Tokyo" can be searched as flights to HND or NRT
const CITY_AIRPORTS = {
    tokyo: ['HND', 'NRT'], seattle: ['SEA'], taipei: ['TPE'], seoul: ['ICN'],
    'los angeles': ['LAX'], 'san francisco': ['SFO'],
};
const AIRPORT_CITY = Object.fromEntries(Object.entries(CITY_AIRPORTS).flatMap(([city, codes]) => codes.map((c) => [c, city])));

const round2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- 1. validation

function validateRequest(body) {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Request body must be a JSON object');
    const allowed = ['user_id', 'trip_id', 'origin', 'destination', 'nights', 'travelers', 'budget', 'currency', 'preferences', 'include_car'];
    const problems = [];
    for (const key of Object.keys(body)) if (!allowed.includes(key)) problems.push({ field: key, message: 'is not a recognised field' });

    const str = (name, { required, max = 100 } = {}) => {
        const v = body[name];
        if (v === undefined || v === null) { if (required) problems.push({ field: name, message: 'is required' }); return undefined; }
        if (typeof v !== 'string' || !v.trim()) { problems.push({ field: name, message: 'must be a non-empty string' }); return undefined; }
        if (v.trim().length > max) { problems.push({ field: name, message: `must be at most ${max} characters` }); return undefined; }
        return v.trim();
    };
    const num = (name, { required, min, max, integer, fallback } = {}) => {
        const v = body[name];
        if (v === undefined || v === null) { if (required) problems.push({ field: name, message: 'is required' }); return fallback; }
        if (typeof v !== 'number' || !Number.isFinite(v) || (integer && !Number.isInteger(v))) { problems.push({ field: name, message: integer ? 'must be an integer' : 'must be a number' }); return fallback; }
        if (min !== undefined && v < min) { problems.push({ field: name, message: `must be at least ${min}` }); return fallback; }
        if (max !== undefined && v > max) { problems.push({ field: name, message: `must be at most ${max}` }); return fallback; }
        return v;
    };

    const request = {
        user_id: str('user_id', { required: true, max: 50 }),
        trip_id: num('trip_id', { integer: true, min: 1 }),
        origin: str('origin', { max: 3 }),
        destination: str('destination', { required: true }),
        nights: num('nights', { integer: true, min: 1, max: 30, fallback: 3 }),
        travelers: num('travelers', { integer: true, min: 1, max: 9, fallback: 1 }),
        budget: num('budget', { required: true, min: 1 }),
        currency: str('currency', { max: 3 }) || 'USD',
        preferences: str('preferences', { max: 200 }),
        include_car: body.include_car === undefined || body.include_car === null ? false : body.include_car,
    };
    if (typeof request.include_car !== 'boolean') problems.push({ field: 'include_car', message: 'must be true or false' });
    if (request.origin && !/^[A-Za-z]{3}$/.test(request.origin)) problems.push({ field: 'origin', message: 'must be a 3-letter airport code' });
    if (problems.length) throw badRequest('Validation failed', problems);
    if (request.origin) request.origin = request.origin.toUpperCase();
    return request;
}

// ---------------------------------------------------------------- 2. calls to the other services

const serviceUrl = (name, fallback) => process.env[name] || fallback;

async function getList(label, baseUrl, path, params) {
    const url = new URL(path, baseUrl);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    let res;
    try {
        res = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    } catch {
        throw new HttpError(502, 'SERVICE_UNAVAILABLE', `The ${label} service is unavailable`);
    }
    if (!res.ok) throw new HttpError(502, 'SERVICE_UNAVAILABLE', `The ${label} service answered ${res.status}`);
    return (await res.json()).data || [];
}

async function gather(request) {
    const dest = request.destination;
    const isCode = /^[A-Za-z]{3}$/.test(dest);
    const city = isCode ? (AIRPORT_CITY[dest.toUpperCase()] || dest) : dest;
    const airports = isCode ? [dest.toUpperCase()] : (CITY_AIRPORTS[dest.toLowerCase()] || []);

    const flightsPromise = request.origin && airports.length
        ? Promise.all(airports.map((code) => getList('Flight', serviceUrl('FLIGHT_SERVICE_URL', 'http://localhost:3004'), '/api/flights',
            { origin: request.origin, destination: code, sort: 'price', limit: 20 }))).then((lists) => lists.flat())
        : Promise.resolve([]);
    const hotelsPromise = getList('Hotel', serviceUrl('HOTEL_SERVICE_URL', 'http://localhost:3005'), '/api/hotels',
        { city, available: true, sort: 'rating', order: 'desc', limit: 20 });
    const activitiesPromise = getList('Activity', serviceUrl('ACTIVITY_SERVICE_URL', 'http://localhost:3007'), '/api/activities',
        { city, sort: 'rating', order: 'desc', limit: 20 });

    const carsPromise = request.include_car === true
        ? getList('Car Rental', serviceUrl('CAR_RENTAL_SERVICE_URL', 'http://localhost:3006'), '/api/car-rentals', { city, available: true, sort: 'price_per_day', limit: 20 })
        : Promise.resolve([]);

    const [flights, hotels, activities, cars] = await Promise.all([flightsPromise, hotelsPromise, activitiesPromise, carsPromise]);
    const sameCurrency = (x) => !x.currency || x.currency === request.currency;
    return { city, flights: flights.filter(sameCurrency), hotels: hotels.filter(sameCurrency), activities: activities.filter(sameCurrency), cars: cars.filter(sameCurrency) };
}

// ---------------------------------------------------------------- 3. choosing and costing (plain code)

// Cost of a chosen package. Always computed here, never by the model.
function computeCost({ flight, hotel, car, activities }, { nights, travelers, budget }) {
    const breakdown = {
        flights: round2(flight ? flight.price * travelers : 0),
        hotel: round2(hotel ? hotel.price_per_night * nights : 0),
        car_rental: round2(car ? car.price_per_day * nights : 0),
        activities: round2(activities.reduce((sum, a) => sum + (a.price || 0), 0) * travelers),
    };
    const total = round2(breakdown.flights + breakdown.hotel + breakdown.car_rental + breakdown.activities);
    return { breakdown, total, within_budget: total <= budget, remaining: round2(budget - total) };
}

// Rule-based choice that tries to stay inside the budget: cheapest flight, best-rated hotel that
// still fits, then the best-rated activities while money remains.
function selectByRules({ flights, hotels, activities, cars = [] }, { nights, travelers, budget }) {
    const flight = flights.length ? [...flights].sort((a, b) => a.price - b.price)[0] : null;
    let spent = flight ? flight.price * travelers : 0;

    const byRating = [...hotels].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const hotel = byRating.find((h) => spent + h.price_per_night * nights <= budget)
        || [...hotels].sort((a, b) => a.price_per_night - b.price_per_night)[0] || null;
    if (hotel) spent += hotel.price_per_night * nights;

    const car = cars.length ? [...cars].sort((a, b) => a.price_per_day - b.price_per_day)[0] : null;
    if (car) spent += car.price_per_day * nights;

    const chosen = [];
    const ranked = [...activities].sort((a, b) => (b.rating || 0) - (a.rating || 0) || (a.price || 0) - (b.price || 0));
    for (const act of ranked) {
        if (chosen.length >= MAX_ACTIVITIES) break;
        const cost = (act.price || 0) * travelers;
        if (spent + cost <= budget) { chosen.push(act); spent += cost; }
    }
    return { flight, hotel, car, activities: chosen };
}

// Turn the model's ids into real records. Returns null if any id is not in the results.
function resolveChoice(choice, { flights, hotels, activities, cars = [] }) {
    if (!choice || typeof choice !== 'object') return null;
    const find = (list, id) => list.find((x) => x.id === id);
    const flight = choice.flight_id == null ? null : find(flights, choice.flight_id);
    const hotel = choice.hotel_id == null ? null : find(hotels, choice.hotel_id);
    const car = choice.car_rental_id == null ? null : find(cars, choice.car_rental_id);
    if ((choice.flight_id != null && !flight) || (choice.hotel_id != null && !hotel) || (choice.car_rental_id != null && !car)) return null;
    const ids = Array.isArray(choice.activity_ids) ? choice.activity_ids.slice(0, MAX_ACTIVITIES) : [];
    const acts = ids.map((id) => find(activities, id));
    if (acts.some((a) => !a)) return null;
    if (!flight && !hotel && !acts.length) return null;
    return { flight, hotel, car, activities: acts };
}

function templateSummary(request, selection, cost, city) {
    const parts = [];
    if (selection.flight) parts.push(`Fly ${selection.flight.airline} ${selection.flight.flight_number} (${selection.flight.origin} to ${selection.flight.destination}, $${selection.flight.price} per traveler)`);
    if (selection.hotel) parts.push(`stay ${request.nights} night${request.nights === 1 ? '' : 's'} at ${selection.hotel.name} ($${selection.hotel.price_per_night} per night)`);
    if (selection.car) parts.push(`rent a ${selection.car.model} from ${selection.car.company} ($${selection.car.price_per_day} per day)`);
    if (selection.activities.length) parts.push(`do ${selection.activities.map((a) => a.name).join(', ')}`);
    const trip = parts.length ? `${parts.join('; ')}.` : `No flights, hotels or activities were selected for ${city}.`;
    const money = cost.within_budget
        ? `Total $${cost.total} of your $${request.budget} budget, with $${cost.remaining} left.`
        : `Total $${cost.total} is $${round2(-cost.remaining)} over your $${request.budget} budget.`;
    return `${trip} ${money}`;
}

// ---------------------------------------------------------------- 4. the language model

async function askModel(request, lists) {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: Number(process.env.LLM_TIMEOUT_MS) || 30000, maxRetries: 0 });
    const compact = {
        flights: lists.flights.map((f) => ({ id: f.id, airline: f.airline, number: f.flight_number, from: f.origin, to: f.destination, price: f.price })),
        hotels: lists.hotels.map((h) => ({ id: h.id, name: h.name, stars: h.stars, rating: h.rating, price_per_night: h.price_per_night })),
        activities: lists.activities.map((a) => ({ id: a.id, name: a.name, category: a.category, price: a.price, rating: a.rating })),
        ...(request.include_car ? { cars: lists.cars.map((c) => ({ id: c.id, company: c.company, model: c.model, price_per_day: c.price_per_day })) } : {}),
    };
    let text;
    try {
        const completion = await groq.chat.completions.create({
            model: MODEL, temperature: 0.3, max_completion_tokens: 800, response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: 'You plan trips. Choose ONE flight, ONE hotel, ONE car (only if cars are listed) and up to 3 activities ONLY from the lists given, using their ids. Stay within the budget if possible. Never invent items or prices. Reply with JSON only: {"flight_id": number|null, "hotel_id": number|null, "car_rental_id": number|null, "activity_ids": [number], "summary": "2-3 sentences explaining the choice"}.' },
                { role: 'user', content: JSON.stringify({ request: { destination: request.destination, nights: request.nights, travelers: request.travelers, budget: request.budget, currency: request.currency, preferences: request.preferences || null }, options: compact }) },
            ],
        });
        text = completion.choices?.[0]?.message?.content ?? '';
    } catch (err) {
        console.error(`[llm] recommendation request failed: ${err.message}`);
        throw new HttpError(502, 'LLM_UNAVAILABLE', 'The language model did not give an answer. Nothing was saved.');
    }
    try { return JSON.parse(text); } catch { return null; }
}

// ---------------------------------------------------------------- the route

function recommendRouter(pool) {
    const router = express.Router();

    router.post('/recommendations', async (req, res) => {
        const request = validateRequest(req.body);
        const lists = await gather(request);
        if (!lists.flights.length && !lists.hotels.length && !lists.activities.length && !lists.cars.length) {
            throw notFound(`No flights, hotels or activities found for ${request.destination}`);
        }

        let selection = null, summary = null, source = 'stub', model = 'stub';
        if (process.env.GROQ_API_KEY) {
            const answer = await askModel(request, lists);
            const chosen = resolveChoice(answer, lists);
            if (chosen && computeCost(chosen, request).within_budget) {
                selection = chosen; source = 'llm'; model = MODEL;
                summary = typeof answer.summary === 'string' && answer.summary.trim() ? answer.summary.trim() : null;
            }
        }
        if (!selection) selection = selectByRules(lists, request);   // no key, bad choice, or over budget

        const cost = computeCost(selection, request);
        summary = summary ? `${summary} Total $${cost.total} of your $${request.budget} budget.` : templateSummary(request, selection, cost, lists.city);

        const prompt = `Recommend a ${request.nights}-night trip to ${request.destination}${request.origin ? ` from ${request.origin}` : ''} for ${request.travelers} traveler${request.travelers === 1 ? '' : 's'} with a budget of ${request.budget} ${request.currency}${request.include_car ? ', including a rental car' : ''}${request.preferences ? `; preferences: ${request.preferences}` : ''}`;
        const { rows } = await pool.query(
            `INSERT INTO advice (user_id, trip_id, topic, prompt, content, model, source)
             VALUES ($1, $2, 'itinerary', $3, $4, $5, $6) RETURNING id`,
            [request.user_id, request.trip_id ?? null, prompt, summary, model, source]);

        res.status(201).location(`/api/advice/${rows[0].id}`).json({
            id: rows[0].id,
            summary,
            selection: { flight_id: selection.flight?.id ?? null, hotel_id: selection.hotel?.id ?? null, car_rental_id: selection.car?.id ?? null, activity_ids: selection.activities.map((a) => a.id) },
            breakdown: cost.breakdown,
            total: cost.total,
            budget: request.budget,
            currency: request.currency,
            within_budget: cost.within_budget,
            remaining: cost.remaining,
            source,
            model,
        });
    });

    return router;
}

module.exports = { recommendRouter, validateRequest, computeCost, selectByRules, resolveChoice, templateSummary };
