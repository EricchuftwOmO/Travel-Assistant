# Backend

Each service has its own folder, `Dockerfile`, `package.json`, `GET /health` and `openapi.yaml`.
`docker compose up --build` in the parent folder starts them all. Clients only talk to the gateway (port 8080).

| Folder | Port | Owns | Data |
|---|---|---|---|
| `gateway` | 8080 | GraphQL (`/graphql`, `/api/graphql`), routing, login check via the user service, CORS, request IDs, timeouts, `/api/health` | none |
| `user-service` | 3009 | `/api/auth` (register, login, Google, validate), `/api/users` (REST) | `user_db` |
| `trip-service` | 3001 | `/api/trips` (+ flights, itineraries), `/api/places` | `trip_db` |
| `flight-service` | 3004 | `/api/flights` | `flight_db` + Redis cache |
| `hotel-service` | 3005 | `/api/hotels` | `hotel_db` + Redis cache |
| `car-rental-service` | 3006 | `/api/car-rentals` | `car_rental_db` + Redis cache |
| `activity-service` | 3007 | `/api/activities` | `activity_db` + Redis cache |
| `llm-service` | 3008 | `/api/advice` | `llm_db` |

The Budget service is planned, not built yet.

## Login

Only the user service does authentication. It signs the token (JWT, `JWT_SECRET`) at `POST /api/auth/register`,
`/login` or `/google`, and no other service knows the secret. For every other protected route the gateway calls the
user service's `GET /api/auth/validate` with the client's `Authorization` header, then passes the user id on as `X-User-Id`
(a client-sent `X-User-Id` is dropped). The trip service trusts that header, so it is only reachable through the gateway
and the user service.
Public: register, login, Google sign-in, health checks, and `GET` on flights, hotels, car rentals and activities.
Everything else returns `401`. Deleting an account first asks the trip service to delete that user's trips
(`DELETE /internal/my-data` with `X-User-Id`, not routed by the gateway), then deletes the account.

## Sign in with Google

The browser gets a Google ID token (Google Identity Services, as in tutorial 7) and sends it to
GraphQL `loginWithGoogle(credential)`, which calls `POST /api/auth/google` on the user service. The user service
verifies the token with `google-auth-library` against `GOOGLE_CLIENT_ID` (and requires a verified email), then finds the
account by Google id, links an existing account with the same email, or creates one, and answers with our own
JWT like a password login. Set `GOOGLE_CLIENT_ID` in `.env` (user service and frontend build; empty = off, the endpoint
returns 503 and the button is hidden). Add the page's address (`http://localhost:5173`) as an authorised JavaScript
origin for the client ID. The client secret is not needed.

## User service (REST)

JSON over HTTP, always about "me" (the account comes from the token). `POST /api/auth/register|login|google`,
`GET /api/auth/validate`, `GET|PUT|DELETE /api/users/me`, `PATCH /api/users/me/basic-info`,
`GET|PATCH /api/users/me/language-settings`, `GET|PATCH /api/users/me/travel-preferences`. Full spec: `openapi.yaml`
(Swagger UI on port 3009). The frontend does not call these directly, nor any other service's REST API: it uses only the
gateway's GraphQL API (`backend/gateway/README.md`), which calls them. The REST routes stay available through the gateway for other clients and the Postman tests.
Profiles live in `users` (first/last name, gender, date of birth, phone, country, language, timezone, `google_sub`) and
`travel_preferences` (budget level, travel styles). `schema.sql` runs on every start and upgrades an older
`users` table in place.

## Google Places (Add place map)

`GET /api/places/nearby?lat&lng&radius&category` and `GET /api/places/locate?q=Tokyo` call Google Places
API (New) from the trip service with `GOOGLE_PLACES_API_KEY` (field masks keep the billed fields small; answers
are cached in memory for 5 minutes). `POST .../items { googlePlaceId, position }` reads the place from Google
and saves it in `places` (`google_place_id`, address, lat, lng). Without a key these return 503 and the app
uses the sample catalog (`GET /api/places`, `{ placeId }`). The browser map uses the same key (or
`GOOGLE_MAPS_API_KEY`) through the Maps JavaScript API.

## Trip flights

`POST /api/trips/:id/flights { flightId }` (or `flightId` in `POST /api/trips`) makes the trip service read
the flight from the flight service and copy its details into `trip_flights`. `GET /api/trips/:id` includes `flights`.

## Docs

API docs are in `gateway/openapi.yaml` (everything) and each service's `openapi.yaml`, also served as
Swagger UI at `http://localhost:<port>/docs` (only with `docker-compose.dev.yml`; the services are private otherwise). The trip service has its own [README](trip-service/README.md).

## The CRUD services

Flights, hotels, car rentals, activities and advice share the same code. Only `src/resource.js` differs
(fields, filters, sample data); `src/crud.js` builds the table, validation and routes from it.

| Request | Result |
|---|---|
| `GET /api/<things>` | `200 { count, total, data }`, with filters, `sort`, `order`, `limit`, `offset` |
| `POST /api/<things>` | `201` + `Location` |
| `GET /api/<things>/:id` | `200` or `404` |
| `PUT` / `PATCH /api/<things>/:id` | `200` full / partial update |
| `DELETE /api/<things>/:id` | `204` |

Errors: `{ "error": { "code", "message", "details" } }`. A `400` lists every bad field in `details`.
`GET` responses are cached in Redis for 60 s and cleared on any write; if Redis is down, PostgreSQL is used.

## LLM service

- `POST /api/advice` with a `prompt` and no `content` asks Groq for the answer (`GROQ_API_KEY`, `LLM_MODEL`).
  Without a key it saves a placeholder (`source: "stub"`). A model failure returns `502 LLM_UNAVAILABLE`.
- `POST /api/advice/recommendations` (`src/recommend.js`) gathers flights, hotels, activities and optionally cars
  from the other services, picks a package, adds up the cost in code, and saves the summary.

## Changing a service

Edit `src/resource.js` and `openapi.yaml`. Tables are only created if missing, so run `docker compose down -v`
to reset data after adding a column.
To add a service: copy a CRUD service folder, add it to `docker-compose.yml`, a `*_SERVICE_URL` and rule in the
gateway's `src/config.js` and `src/routes.js`, and a test case.
