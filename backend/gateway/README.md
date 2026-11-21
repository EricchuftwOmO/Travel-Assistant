# API Gateway

The single entry point for clients. The frontend uses its GraphQL API (`/graphql`, also at `/api/graphql`). It also forwards
each REST `/api/*` request to the service that owns it, and adds CORS, `X-Request-Id`, timeouts and uniform errors.
It has no database and no business logic, and it never reads a login token itself: it asks the user service.

## Routing

The first matching rule wins (`src/routes.js`). Paths, queries, methods and bodies are forwarded unchanged.

| Path | Service | Timeout |
|---|---|---|
| `/api/trips/:id/budget`, `/api/budget/*` | Budget (planned) | 5 s |
| `/api/auth/*`, `/api/users/*` | User | 5 s |
| `/api/trips/*`, `/api/places` | Trip | 5 s |
| `/api/activities/*` | Activity | 5 s |
| `/api/flights/*` | Flight | 5 s |
| `/api/hotels/*` | Hotel | 5 s |
| `/api/car-rentals/*` | Car Rental | 5 s |
| `/api/advice/*` | LLM | 40 s |
| `/api/planner/*` | AI Planner (not routed unless a URL is set) | 60 s |

## GraphQL (`/graphql`, `/api/graphql`)

One GraphQL endpoint (GraphQL Yoga, as in tutorial 7); open it in a browser for GraphiQL. The resolvers call the REST
services with the same URLs and timeouts as the proxy.

```graphql
query {
  me { name email languageSettings { timezone } }          # User Service (needs "Authorization: Bearer <token>")
  trip(id: 1) {                                            # Trip Service (needs a login)
    title destination
    hotels(minStars: 4) { name pricePerNight }             # Hotel Service
    activities { name category }                           # Activity Service
    carRentals { model pricePerDay }                       # Car Rental Service
  }
  flights(origin: "SEA", sort: price) { airline flightNumber price }   # public
}
```

- **Accounts (User Service):** queries `me`, `myLanguageSettings`, `myTravelPreferences` (null when signed out); mutations
  `register`, `login`, `loginWithGoogle(credential)`, `updateBasicInfo`, `updateLanguageSettings`,
  `updateTravelPreferences`, `updateMe`, `deleteMe`. `register`, `login` and `loginWithGoogle` return `{ token, user }`.
- **Catalog:** `flights`, `hotels`, `carRentals`, `activities` (public, with the REST filters) and `flight(id)`, `hotel(id)`, etc.
- **Trips (Trip Service, login required):** queries `myTrips(search, status)`, `trip(id)` (null if not the caller's),
  `itineraryDay(tripId, dayNumber)`; mutations `createTrip` (optional `flightId`), `updateTrip`, `deleteTrip`,
  `attachFlight`, `detachFlight(tripId, tripFlightId)`, `addItineraryItem` (`placeId` or `googlePlaceId`, `position`),
  `removeItineraryItem`, `reorderItineraryItems`. `Trip.flights`, `Trip.itineraries` (days with `placeCount`) and
  `Trip.hotels / activities / carRentals` (joined by the trip's destination city) are read only when a query asks for them,
  so the trip page loads in one request. The Trip Service gets the validated user as `X-User-Id`.
- **Places (login required):** `places(city, category)` (sample catalog), `placesConfig`, `nearbyPlaces`, `locatePlace`
  (null when Google finds nothing; the Google ones fail with a 503 error while no Google Places key is set).
- **Advice (LLM Service, login required):** `myAdvice(tripId, topic, limit)` (newest first) and `askAdvice(tripId, topic, prompt)`.
  There is no user id argument: the gateway adds the id the user service reports, so nobody can read or write another user's advice.
- Ids are `ID` values (strings) and are converted to numbers for the services. A mutation on a missing trip, day or item
  fails with `NOT_FOUND`; a bad request with `BAD_USER_INPUT` (field problems in `extensions.details`); a refused change with `CONFLICT`.
  All REST routes still work too (the Postman collection uses them); the frontend only uses GraphQL.
- A missing item is `null`. A failing service gives an error with `extensions.code` (`UPSTREAM_UNAVAILABLE`, `UPSTREAM_TIMEOUT`,
  `UNAUTHENTICATED`, `BAD_USER_INPUT`, `CONFLICT`), `extensions.status` and `extensions.details` on that field only; the other fields still return data.
  A query that does not parse or fit the schema returns HTTP 400.

## Login check (`src/auth.js`)

Only the user service knows the JWT secret. For a REST route that needs a login, the gateway calls the user service's
`GET /api/auth/validate` with the client's `Authorization` header: `401 UNAUTHORIZED` if it says no, `502` / `504` if the
user service cannot be reached. On success the user id is forwarded to the owning service as `X-User-Id`;
a client-sent `X-User-Id` is always removed.

- Public without a token: `POST /api/auth/register`, `/login`, `/google`, `/health`, `/api/health`, and `GET` on flights, hotels,
  car rentals and activities.
- `/api/auth/*` and `/api/users/*` go straight to the user service, which checks the token on its own routes.
- GraphQL does the same per field: `trip` and `myTrips` ask the user service who the caller is (once per request);
  account fields pass the token to the user service.
- The Trip Service trusts `X-User-Id`, so it must only be reachable through the gateway (and the user service).

## Other behavior

- **`X-Request-Id`**: a valid client value is kept, otherwise a UUID is made. It goes to the service, the response and the logs.
- **CORS**: only for `CORS_ORIGINS`. Preflight requests are answered by the gateway.
- **Errors** are `{ "error": { "code", "message" } }`. Errors from a service pass through unchanged.

| Status | Code | When |
|---|---|---|
| 401 | `UNAUTHORIZED` | missing or invalid token (the user service says so) |
| 404 | `NOT_FOUND` | no service owns the path |
| 502 | `UPSTREAM_UNAVAILABLE` | service is down |
| 504 | `UPSTREAM_TIMEOUT` | service did not answer in time |
| 500 | `INTERNAL_ERROR` | unexpected gateway error |

## Health

- `GET /health`: the gateway's own check (used by Docker).
- `GET /api/health`: calls `/health` on every configured service. `200 "ok"` if all are up, otherwise `503 "degraded"`
  with the status of each.

## Run

```sh
cd backend/gateway
npm install
npm start        # defaults work locally; see .env.example
npm test         # 42 tests with stub services
```

In `docker-compose.yml` the gateway is the only service with a public port.

## Layout

```
server.js           starts the server
src/config.js       environment variables
src/routes.js       route table
src/auth.js         login check (asks the user service)
src/graphql/        GraphQL schema, resolvers, calls to the services
src/proxy.js        proxy per route, 502/504 errors
src/middleware.js   request IDs, CORS, logging
src/health.js       combined health check
src/errors.js       JSON errors
test/               node:test tests
```
