// One function per field that needs code. Fields without a resolver use the default: parent[fieldName].
// The services return snake_case fields, so each type maps them to the camelCase names in schema.graphql.

const { upstream, upstreamGet, asToken, asUser, asUserMutation, requireUserId } = require('./upstream');

const snake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const pick = (field) => (parent) => parent[field];

// GET /api/<resource> returns { count, total, data }
async function list(ctx, service, path, args) {
    const { sort, ...rest } = args;
    const body = await upstreamGet(ctx, service, path, { ...rest, sort: sort && snake(sort) });
    return body?.data ?? [];
}

// A signed-out caller gets null for "me" style fields instead of an error.
const signedOut = (promise) => promise.catch((err) => {
    if (err.extensions?.code === 'UNAUTHENTICATED') return null;
    throw err;
});

// register / login / Google sign-in all answer { user, token }. The user is then re-read with the new
// token so it is the full profile (nested settings and preferences), the same as `me`.
async function signIn(ctx, path, body) {
    const result = await upstream(ctx, 'user', { method: 'POST', path, body });
    const user = await upstream(ctx, 'user', {
        path: '/api/users/me',
        headers: { Authorization: `Bearer ${result.token}` },
    });
    return { token: result.token, user: user ?? result.user };
}

// The services want real numbers for ids (GraphQL ID values arrive as strings). A bad one becomes null,
// which the service then rejects with its own validation message.
const num = (id) => (id === undefined || id === null ? undefined : Number(id));

// Drops null / undefined so an optional GraphQL input does not reach the service as an explicit null.
const compact = (object) => Object.fromEntries(Object.entries(object).filter(([, v]) => v !== null && v !== undefined));

const tripPath = (id) => `/api/trips/${encodeURIComponent(id)}`;
const dayPath = (tripId, dayNumber) => `${tripPath(tripId)}/itineraries/${encodeURIComponent(dayNumber)}`;

const item = (ctx, service, path, id) => upstreamGet(ctx, service, `${path}/${encodeURIComponent(id)}`);

const resolvers = {
    Query: {
        flights: (_p, args, ctx) => list(ctx, 'flight', '/api/flights', args),
        flight: (_p, { id }, ctx) => item(ctx, 'flight', '/api/flights', id),

        hotels: (_p, args, ctx) => list(ctx, 'hotel', '/api/hotels', args),
        hotel: (_p, { id }, ctx) => item(ctx, 'hotel', '/api/hotels', id),

        carRentals: (_p, args, ctx) => list(ctx, 'carRental', '/api/car-rentals', args),
        carRental: (_p, { id }, ctx) => item(ctx, 'carRental', '/api/car-rentals', id),

        activities: (_p, args, ctx) => list(ctx, 'search', '/api/activities', args),
        activity: (_p, { id }, ctx) => item(ctx, 'search', '/api/activities', id),

        // Trips need a login: the gateway asks the user service who the caller is, and the Trip Service trusts that
        myTrips: async (_p, args, ctx) => (await asUser(ctx, 'trip', { path: '/api/trips', query: args })) ?? [],
        trip: (_p, { id }, ctx) => asUser(ctx, 'trip', { path: `/api/trips/${encodeURIComponent(id)}` }),

        // One day with its places. Null when the trip is not the caller's or has no such day.
        itineraryDay: (_p, { tripId, dayNumber }, ctx) => asUser(ctx, 'trip', { path: dayPath(tripId, dayNumber) }),

        places: async (_p, args, ctx) => (await asUser(ctx, 'trip', { path: '/api/places', query: args })) ?? [],
        placesConfig: (_p, _a, ctx) => asUser(ctx, 'trip', { path: '/api/places/config' }),
        nearbyPlaces: async (_p, args, ctx) =>
            (await asUser(ctx, 'trip', { path: '/api/places/nearby', query: args })) ?? [],
        locatePlace: (_p, { query, language }, ctx) =>
            asUser(ctx, 'trip', { path: '/api/places/locate', query: { q: query, language } }),

        // Advice is stored per user. The caller's id comes from the user service, never from the client.
        myAdvice: async (_p, { tripId, topic, limit }, ctx) => {
            const userId = await requireUserId(ctx);
            const body = await upstream(ctx, 'llm', {
                path: '/api/advice',
                query: { userId, tripId, topic, sort: 'created_at', order: 'desc', limit },
            });
            return body?.data ?? [];
        },

        // Account data lives in the User Service. These are null (not an error) when nobody is signed in.
        me: (_p, _a, ctx) => signedOut(asToken(ctx, 'user', { path: '/api/users/me' })),
        myLanguageSettings: (_p, _a, ctx) =>
            signedOut(asToken(ctx, 'user', { path: '/api/users/me/language-settings' })),
        myTravelPreferences: (_p, _a, ctx) =>
            signedOut(asToken(ctx, 'user', { path: '/api/users/me/travel-preferences' })),
    },

    Mutation: {
        createTrip: (_p, { input }, ctx) =>
            asUserMutation(ctx, 'trip', {
                method: 'POST', path: '/api/trips', body: compact({ ...input, flightId: num(input.flightId) }),
            }),
        updateTrip: (_p, { id, input }, ctx) =>
            asUserMutation(ctx, 'trip', { method: 'PUT', path: tripPath(id), body: input }),
        deleteTrip: async (_p, { id }, ctx) => {
            await asUserMutation(ctx, 'trip', { method: 'DELETE', path: tripPath(id) });
            return true;
        },
        attachFlight: (_p, { tripId, flightId }, ctx) =>
            asUserMutation(ctx, 'trip', { method: 'POST', path: `${tripPath(tripId)}/flights`, body: { flightId: num(flightId) } }),
        detachFlight: async (_p, { tripId, tripFlightId }, ctx) => {
            await asUserMutation(ctx, 'trip', { method: 'DELETE', path: `${tripPath(tripId)}/flights/${encodeURIComponent(tripFlightId)}` });
            return true;
        },

        addItineraryItem: (_p, { tripId, dayNumber, input }, ctx) =>
            asUserMutation(ctx, 'trip', {
                method: 'POST',
                path: `${dayPath(tripId, dayNumber)}/items`,
                body: compact({ ...input, placeId: num(input.placeId) }),
            }),
        removeItineraryItem: async (_p, { tripId, dayNumber, itemId }, ctx) => {
            await asUserMutation(ctx, 'trip', { method: 'DELETE', path: `${dayPath(tripId, dayNumber)}/items/${encodeURIComponent(itemId)}` });
            return true;
        },
        reorderItineraryItems: (_p, { tripId, dayNumber, itemIds }, ctx) =>
            asUserMutation(ctx, 'trip', {
                method: 'PUT', path: `${dayPath(tripId, dayNumber)}/items/order`, body: { itemIds: itemIds.map(num) },
            }),

        askAdvice: async (_p, { tripId, topic, prompt }, ctx) => {
            const userId = await requireUserId(ctx);
            return upstream(ctx, 'llm', {
                method: 'POST',
                path: '/api/advice',
                body: compact({ user_id: String(userId), trip_id: num(tripId), topic, prompt }),
                notFound: 'error',
            });
        },

        register: (_p, { input }, ctx) => signIn(ctx, '/api/auth/register', input),
        login: (_p, args, ctx) => signIn(ctx, '/api/auth/login', args),
        loginWithGoogle: (_p, { credential }, ctx) => signIn(ctx, '/api/auth/google', { credential }),

        updateBasicInfo: (_p, { input }, ctx) =>
            asToken(ctx, 'user', { method: 'PATCH', path: '/api/users/me/basic-info', body: input }),
        updateLanguageSettings: (_p, { input }, ctx) =>
            asToken(ctx, 'user', { method: 'PATCH', path: '/api/users/me/language-settings', body: input }),
        updateTravelPreferences: (_p, { input }, ctx) =>
            asToken(ctx, 'user', { method: 'PATCH', path: '/api/users/me/travel-preferences', body: input }),
        updateMe: (_p, { input }, ctx) => asToken(ctx, 'user', { method: 'PUT', path: '/api/users/me', body: input }),
        deleteMe: async (_p, _a, ctx) => {
            await asToken(ctx, 'user', { method: 'DELETE', path: '/api/users/me' });
            return true;
        },
    },

    // The trip list has no nested data, so flights and days are read when a query asks for them.
    // The trip's destination is a city name, so hotels, activities and rental cars join by city.
    Trip: {
        flights: async (trip, _a, ctx) =>
            trip.flights ?? (await asUser(ctx, 'trip', { path: `${tripPath(trip.id)}/flights` })) ?? [],
        itineraries: async (trip, _a, ctx) =>
            (await asUser(ctx, 'trip', { path: `${tripPath(trip.id)}/itineraries` })) ?? [],
        hotels: (trip, args, ctx) => list(ctx, 'hotel', '/api/hotels', { city: trip.destination, ...args }),
        activities: (trip, args, ctx) => list(ctx, 'search', '/api/activities', { city: trip.destination, ...args }),
        carRentals: (trip, args, ctx) => list(ctx, 'carRental', '/api/car-rentals', { city: trip.destination, ...args }),
    },

    // A day from the list has placeCount only; its places are read on demand.
    ItineraryDay: {
        items: async (day, _a, ctx) =>
            day.items ?? (await asUser(ctx, 'trip', { path: dayPath(day.tripId, day.dayNumber) }))?.items ?? [],
        placeCount: (day) => day.placeCount ?? day.items?.length ?? 0,
    },

    Advice: {
        tripId: pick('trip_id'),
        createdAt: pick('created_at'),
    },

    // The REST user has these nested objects already; the fallback covers a user without them.
    User: {
        languageSettings: (u) => u.languageSettings ?? { language: u.language, timezone: u.timezone },
        travelPreferences: (u) => u.travelPreferences ?? { budgetLevel: null, travelStyles: [] },
    },

    Flight: {
        flightNumber: pick('flight_number'),
        departAt: pick('depart_at'),
        arriveAt: pick('arrive_at'),
        seatsAvailable: pick('seats_available'),
        departLocal: pick('depart_local'),
        arriveLocal: pick('arrive_local'),
    },

    Hotel: {
        pricePerNight: pick('price_per_night'),
    },

    CarRental: {
        carType: pick('car_type'),
        pickupCity: pick('pickup_city'),
        pricePerDay: pick('price_per_day'),
    },

    Activity: {
        durationMinutes: pick('duration_minutes'),
    },

};

module.exports = { resolvers };
