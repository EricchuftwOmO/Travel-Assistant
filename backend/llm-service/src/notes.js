// POST /api/advice/trip-notes: pre-trip notes, built as a FIXED chain. The code sets the order:
//   1. user-service  GET /api/users/me                       the traveler (home country, preferences)
//   2. trip-service  GET /api/trips/:id, /itineraries, days   the trip, its flights and its plan
//   3. the code checks the plan itself (activities before the flight lands, empty days, ...)
//   4. Groq, called once with NO tools, returns JSON notes
//   5. the code checks that JSON (categories, days and item ids must match the trip) and keeps its own findings
// Without a key, or when the model fails or answers badly, the notes come from rules over the same data (stub mode).
// Nothing is written anywhere: the notes are only shown.

const express = require('express');
const Groq = require('groq-sdk');
const { HttpError, badRequest, notFound } = require('./errors');

const MODEL = process.env.LLM_MODEL || 'openai/gpt-oss-20b';
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS) || 5000;
const MODEL_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 30000;

const CATEGORIES = ['entry', 'culture', 'weather', 'money', 'transport', 'electricity', 'health', 'safety', 'itinerary'];
const PRIORITIES = ['high', 'medium', 'low'];
const MAX_MODEL_NOTES = 10; // the code's own findings come on top (at most 7)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const positiveInt = (v) => {
    const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v;
    return Number.isSafeInteger(n) && n > 0 ? n : null;
};

// ---------- Steps 1 and 2: the services ----------

async function getJson(fetchImpl, url, headers, label) {
    let res;
    try {
        res = await fetchImpl(url, { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    } catch {
        throw new HttpError(502, 'SERVICE_UNAVAILABLE', `The ${label} service is unavailable`);
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new HttpError(502, 'SERVICE_UNAVAILABLE', `The ${label} service answered ${res.status}`);
    return res.json();
}

// The traveler's profile helps (home country, travel style) but is not needed: without it the notes are more general.
async function readTraveler({ fetchImpl, userServiceUrl, authorization }) {
    if (!authorization) return null;
    try {
        const me = await getJson(fetchImpl, new URL('/api/users/me', userServiceUrl), { Authorization: authorization }, 'User');
        if (!me) return null;
        return {
            home_country: me.country || null,
            language: me.languageSettings?.language || null,
            budget_level: me.travelPreferences?.budgetLevel || null,
            travel_styles: me.travelPreferences?.travelStyles || [],
        };
    } catch (err) {
        console.warn(`[notes] traveler profile not read: ${err.message}`);
        return null;
    }
}

// The trip with its flights and every day's places. Null when the trip is not this user's.
async function readTrip({ fetchImpl, tripServiceUrl, userId, tripId }) {
    const headers = { 'X-User-Id': String(userId) };
    const base = `/api/trips/${tripId}`;
    const trip = await getJson(fetchImpl, new URL(base, tripServiceUrl), headers, 'Trip');
    if (!trip) return null;
    const days = (await getJson(fetchImpl, new URL(`${base}/itineraries`, tripServiceUrl), headers, 'Trip')) || [];
    // Only days with places need their own request.
    const filled = await Promise.all(days.map((day) => (day.placeCount > 0
        ? getJson(fetchImpl, new URL(`${base}/itineraries/${day.dayNumber}`, tripServiceUrl), headers, 'Trip')
        : { ...day, items: [] })));
    return { trip, days: filled.filter(Boolean) };
}

// ---------- Step 3: what the code finds itself ----------

const dateOnly = (iso) => (iso ? String(iso).slice(0, 10) : null);

function buildFacts({ trip, days }, traveler) {
    const flights = [...(trip.flights || [])].sort((a, b) => String(a.departAt).localeCompare(String(b.departAt)));
    const outbound = flights[0] || null;
    const homeward = flights.length > 1 ? flights[flights.length - 1] : null;
    const arrivalDate = outbound ? dateOnly(outbound.arriveAt) : null;

    const plan = days.map((d) => ({
        day: d.dayNumber,
        date: d.date,
        items: (d.items || []).map((i) => ({ item_id: i.id, name: i.place?.name || 'a place', category: i.place?.category || null })),
    }));
    const before = arrivalDate ? plan.filter((d) => d.date < arrivalDate) : [];
    const months = [...new Set(plan.map((d) => MONTHS[Number(d.date.slice(5, 7)) - 1]))];

    return {
        trip: {
            id: trip.id, title: trip.title, destination: trip.destination,
            start_date: trip.startDate, end_date: trip.endDate, days: plan.length,
            months: months.length ? months : [MONTHS[Number(String(trip.startDate).slice(5, 7)) - 1]],
        },
        traveler,
        flights: flights.map((f) => ({
            airline: f.airline, flight_number: f.flightNumber, from: f.origin, to: f.destination,
            departs_utc: f.departAt, arrives_utc: f.arriveAt,
        })),
        plan,
        checks: {
            no_flights: flights.length === 0,
            arrival_flight: outbound ? `${outbound.airline} ${outbound.flightNumber}` : null,
            arrival_date: arrivalDate,
            days_before_arrival: before.map((d) => d.day),
            items_before_arrival: before.flatMap((d) => d.items.map((i) => ({ day: d.day, date: d.date, item_id: i.item_id, name: i.name }))),
            empty_days: plan.filter((d) => !d.items.length && !(arrivalDate && d.date < arrivalDate)).map((d) => d.day),
            return_after_trip_end: Boolean(homeward && dateOnly(homeward.departAt) > trip.endDate),
        },
    };
}

const listDays = (days) => (days.length === 1 ? `Day ${days[0]}` : `Days ${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`);

// Notes about the plan itself. These come from the checks above, so they are kept whatever the model says.
function planNotes(facts) {
    const { checks } = facts;
    const notes = [];
    // One note per day (at most 3 days), naming that day's places.
    const byDay = new Map();
    for (const item of checks.items_before_arrival) byDay.set(item.day, [...(byDay.get(item.day) || []), item]);
    for (const [day, items] of [...byDay].slice(0, 3)) {
        const names = items.map((i) => i.name);
        const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
        notes.push({
            category: 'itinerary', priority: 'high', day, item_id: items.length === 1 ? items[0].item_id : null,
            title: `Day ${day}: ${items.length === 1 ? names[0] : `${items.length} places`} before you land`,
            detail: `${checks.arrival_flight} arrives on ${checks.arrival_date}, but ${list} ${items.length === 1 ? 'is' : 'are'} on Day ${day} (${items[0].date}). Move ${items.length === 1 ? 'it' : 'them'} to a later day.`,
        });
    }
    if (checks.days_before_arrival.length) {
        notes.push({
            category: 'transport', priority: 'high', day: checks.days_before_arrival[0], item_id: null,
            title: 'Your flight lands after the trip starts',
            detail: `${checks.arrival_flight} arrives on ${checks.arrival_date}, so ${listDays(checks.days_before_arrival)} of the trip are spent travelling. Check the trip dates or the flight.`,
        });
    }
    if (checks.return_after_trip_end) {
        notes.push({
            category: 'transport', priority: 'medium', day: null, item_id: null,
            title: 'The last flight leaves after the trip ends',
            detail: `Your last flight leaves after ${facts.trip.end_date}. Make sure you have somewhere to stay until then.`,
        });
    }
    if (checks.no_flights) {
        notes.push({
            category: 'transport', priority: 'medium', day: null, item_id: null,
            title: 'No flight added yet',
            detail: `Add your flight to ${facts.trip.destination} so the plan can be checked against your arrival time.`,
        });
    }
    if (checks.empty_days.length) {
        notes.push({
            category: 'itinerary', priority: 'low', day: checks.empty_days[0], item_id: null,
            title: `${listDays(checks.empty_days)} ${checks.empty_days.length === 1 ? 'has' : 'have'} nothing planned`,
            detail: 'Add a few places, or keep the time free on purpose.',
        });
    }
    return notes;
}

// Stub mode: only what the code can say for sure.
function ruleNotes(facts) {
    const { destination } = facts.trip;
    const passport = facts.traveler?.home_country ? ` for a ${facts.traveler.home_country} passport` : '';
    return sortNotes([
        {
            category: 'entry', priority: 'high', day: null, item_id: null,
            title: 'Check your passport and entry rules',
            detail: `Make sure your passport is valid for the whole stay, and check the visa and entry rules for ${destination}${passport} on the official government site.`,
        },
        ...planNotes(facts),
        {
            category: 'weather', priority: 'low', day: null, item_id: null,
            title: `Check the weather for ${facts.trip.months.join(' and ')}`,
            detail: `Look up the forecast for ${destination} a few days before you leave and pack for it.`,
        },
    ]);
}

// ---------- Step 4: the model (one call, no tools) ----------

const SYSTEM_PROMPT =
    'You write pre-trip notes for a traveler, using only the trip data you are given. Reply with JSON only, in this form: ' +
    '{"notes":[{"category":"entry|culture|weather|money|transport|electricity|health|safety|itinerary",' +
    '"priority":"high|medium|low","title":"at most 60 characters","detail":"one or two sentences, at most 240 characters",' +
    '"day":number or null,"item_id":number or null}]}. ' +
    'Write 6 to 10 notes about what is different for THIS destination in THESE months: local customs and etiquette, ' +
    'the usual weather, money and tipping, plugs and voltage, getting around, health and safety. ' +
    'If the traveler has a home country, say what differs from home. ' +
    'The app already reports the problems listed in "checks" itself, so do not repeat them. You may add other notes ' +
    'about a planned place (category itinerary, e.g. book ahead or dress code), with its day and item_id from "plan"; ' +
    'otherwise day and item_id are null. ' +
    'For visas and entry rules never state a rule as fact: tell the traveler to confirm it on the official government site. ' +
    'Do not invent flights, bookings, prices, opening hours or events.';

const groqJson = () => {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: MODEL_TIMEOUT_MS, maxRetries: 0 });
    return async (messages) => {
        const completion = await groq.chat.completions.create({
            model: MODEL, temperature: 0.3, max_completion_tokens: 2500,
            response_format: { type: 'json_object' }, messages,
        });
        return completion.choices?.[0]?.message?.content ?? '';
    };
};

// ---------- Step 5: check the model's JSON ----------

const text = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, max) : null);
const sortNotes = (notes) => [...notes].sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));

// Keeps the notes that fit the format and the trip; returns null when nothing usable is left.
function cleanNotes(answer, facts) {
    if (!answer || typeof answer !== 'object' || !Array.isArray(answer.notes)) return null;
    const itemDay = new Map(facts.plan.flatMap((d) => d.items.map((i) => [i.item_id, d.day])));
    const notes = [];
    for (const raw of answer.notes) {
        if (!raw || typeof raw !== 'object') continue;
        const category = typeof raw.category === 'string' ? raw.category.toLowerCase().trim() : '';
        const title = text(raw.title, 80);
        const detail = text(raw.detail, 400);
        if (!CATEGORIES.includes(category) || !title || !detail) continue;
        const priority = PRIORITIES.includes(raw.priority) ? raw.priority : 'medium';

        // A day or place must be one of this trip's, so the model cannot point at something that is not there.
        let day = raw.day == null ? null : positiveInt(raw.day);
        let itemId = raw.item_id == null ? null : positiveInt(raw.item_id);
        if (raw.day != null && (!day || day > facts.plan.length)) continue;
        if (raw.item_id != null) {
            if (!itemId || !itemDay.has(itemId)) continue;
            day = itemDay.get(itemId);
        }
        notes.push({ category, priority, title, detail, day, item_id: itemId });
    }
    return notes.length ? notes : null;
}

// The model's notes (at most MAX_MODEL_NOTES) plus all of the code's own findings (the model is told not to
// repeat them). Neither pushes the other out.
function mergeNotes(modelNotes, facts) {
    const notes = [...modelNotes.slice(0, MAX_MODEL_NOTES), ...planNotes(facts)];
    if (!notes.some((n) => n.category === 'entry')) notes.push(ruleNotes(facts).find((n) => n.category === 'entry'));
    return sortNotes(notes);
}

async function askModel(facts, complete) {
    let raw;
    try {
        raw = await complete([
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify(facts) },
        ]);
    } catch (err) {
        console.error(`[notes] model call failed: ${err.message}`);
        return null;
    }
    try {
        return cleanNotes(JSON.parse(raw), facts);
    } catch {
        console.error('[notes] the model did not answer with JSON');
        return null;
    }
}

// ---------- The route ----------

function notesRouter({
    fetchImpl = fetch,
    complete,
    userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3009',
    tripServiceUrl = process.env.TRIP_SERVICE_URL || 'http://localhost:3001',
} = {}) {
    const router = express.Router();

    router.post('/trip-notes', async (req, res) => {
        // The gateway checks the token and sends the caller's id; the trip service trusts the same header.
        const userId = positiveInt(req.get('X-User-Id'));
        if (!userId) throw new HttpError(401, 'UNAUTHORIZED', 'A signed-in user is required (X-User-Id comes from the API gateway)');
        const tripId = positiveInt(req.body?.trip_id);
        if (!tripId) throw badRequest('Validation failed', [{ field: 'trip_id', message: 'must be a positive integer' }]);

        // Steps 1 and 2 run side by side; both are always called, in this one order of the chain.
        const [traveler, data] = await Promise.all([
            readTraveler({ fetchImpl, userServiceUrl, authorization: req.get('Authorization') }),
            readTrip({ fetchImpl, tripServiceUrl, userId, tripId }),
        ]);
        if (!data) throw notFound(`Trip ${tripId} not found`);

        const facts = buildFacts(data, traveler);                         // step 3
        const model = complete || (process.env.GROQ_API_KEY ? groqJson() : null);
        const modelNotes = model ? await askModel(facts, model) : null;   // steps 4 and 5
        const notes = modelNotes ? mergeNotes(modelNotes, facts) : ruleNotes(facts);

        res.json({
            trip_id: data.trip.id,
            destination: data.trip.destination,
            start_date: data.trip.startDate,
            end_date: data.trip.endDate,
            notes,
            source: modelNotes ? 'llm' : 'stub',
            model: modelNotes ? MODEL : 'stub',
            generated_at: new Date().toISOString(),
        });
    });

    return router;
}

module.exports = { notesRouter, buildFacts, ruleNotes, planNotes, cleanNotes, mergeNotes, CATEGORIES };
