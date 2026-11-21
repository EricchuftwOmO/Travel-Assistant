# Backend

Each service has its own folder, `Dockerfile`, `package.json`, `GET /health` and `openapi.yaml`.
`docker compose up --build` in the parent folder starts them all. Clients only talk to the gateway (port 8080).

| Folder | Port | Owns | Data |
|---|---|---|---|
| `gateway` | 8080 | login check, routing, CORS, request IDs, timeouts, `/api/health` | none |
| `user-service` | 3009 | `/api/graphql` (GraphQL), `/api/auth`, `/api/users` | `user_db` |
| `trip-service` | 3001 | `/api/trips` (+ flights, itineraries), `/api/places` | `trip_db` |
| `flight-service` | 3004 | `/api/flights` | `flight_db` + Redis cache |
| `hotel-service` | 3005 | `/api/hotels` | `hotel_db` + Redis cache |
| `car-rental-service` | 3006 | `/api/car-rentals` | `car_rental_db` + Redis cache |
| `activity-service` | 3007 | `/api/activities` | `activity_db` + Redis cache |
| `llm-service` | 3008 | `/api/advice` | `llm_db` |

The Budget service is planned, not built yet.

## Login

The user service signs the token (JWT, `JWT_SECRET`); the gateway checks it before forwarding.
Public: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/graphql` (the user service checks the
token per field), health checks, and `GET` on flights, hotels,
car rentals and activities. Everything else returns `401`. The gateway passes the user id on as `X-User-Id`
and drops any `X-User-Id` a client sends. The trip service checks the token again itself.
Deleting an account (`deleteMe`) first asks the trip service to delete that user's trips
(`DELETE /internal/my-data`, not routed by the gateway), then deletes the account.

## User service (GraphQL)

`POST /graphql` with `{ query, variables }`. Queries: `me`, `myLanguageSettings`, `myTravelPreferences`.
Mutations: `register`, `login`, `deleteMe`, and for the My Profile page `updateBasicInfo`,
`updateLanguageSettings`, `updateTravelPreferences` (partial updates; `null` clears an optional field).
Profiles live in `users` (first/last name, gender, date of birth, phone, country, language, timezone) and
`travel_preferences` (budget level, travel styles). `schema.sql` runs on every start and upgrades an older
`users` table (single `name` column) in place.
The schema text is at `GET /graphql/schema`. Field errors return 200 with `errors[].extensions.code`
(`BAD_USER_INPUT`, `UNAUTHENTICATED`, `CONFLICT`); a query that does not fit the schema returns 400.

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
Swagger UI at `http://localhost:<port>/docs`. The trip service has its own [README](trip-service/README.md).

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
  Without a key it answers with a travel joke (`source: "stub"`). A model failure returns `502 LLM_UNAVAILABLE`.
- `POST /api/advice/recommendations` (`src/recommend.js`) gathers flights, hotels, activities and optionally cars
  from the other services, picks a package, adds up the cost in code, and saves the summary.

## Changing a service

Edit `src/resource.js` and `openapi.yaml`. Tables are only created if missing, so run `docker compose down -v`
to reset data after adding a column.
To add a service: copy a CRUD service folder, add it to `docker-compose.yml`, a `*_SERVICE_URL` and rule in the
gateway's `src/config.js` and `src/routes.js`, and a test case.
