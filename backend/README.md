# Backend

Each service has its own folder, `Dockerfile`, `package.json`, `GET /health` and `openapi.yaml`.
`docker compose up --build` in the parent folder starts them all. Clients only talk to the gateway (port 8080).

| Folder | Port | Owns | Data |
|---|---|---|---|
| `gateway` | 8080 | login check, routing, CORS, request IDs, timeouts, `/api/health` | none |
| `trip-service` | 3001 | `/api/auth`, `/api/users`, `/api/trips`, `/api/places` | `trip_db` |
| `flight-service` | 3004 | `/api/flights` | `flight_db` + Redis cache |
| `hotel-service` | 3005 | `/api/hotels` | `hotel_db` + Redis cache |
| `car-rental-service` | 3006 | `/api/car-rentals` | `car_rental_db` + Redis cache |
| `activity-service` | 3007 | `/api/activities` | `activity_db` + Redis cache |
| `llm-service` | 3008 | `/api/advice` | `llm_db` |

The Budget service is planned, not built yet.

## Login

The gateway checks the bearer token (JWT, signed with `JWT_SECRET`) before forwarding.
Public: `POST /api/auth/register`, `POST /api/auth/login`, health checks, and `GET` on flights, hotels,
car rentals and activities. Everything else returns `401`. The gateway passes the user id on as `X-User-Id`
and drops any `X-User-Id` a client sends. The trip service checks the token again itself.

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
  Without a key it saves a placeholder (`source: "stub"`). A model failure returns `502 LLM_UNAVAILABLE`.
- `POST /api/advice/recommendations` (`src/recommend.js`) gathers flights, hotels, activities and optionally cars
  from the other services, picks a package, adds up the cost in code, and saves the summary.

## Changing a service

Edit `src/resource.js` and `openapi.yaml`. Tables are only created if missing, so run `docker compose down -v`
to reset data after adding a column.
To add a service: copy a CRUD service folder, add it to `docker-compose.yml`, a `*_SERVICE_URL` and rule in the
gateway's `src/config.js` and `src/routes.js`, and a test case.
