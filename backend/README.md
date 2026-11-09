# Travel Assistant backend

Every service lives in its own folder with its own `Dockerfile`, `package.json`,
`GET /health` and OpenAPI file. `docker compose up --build` (or `task up`) in the
parent folder starts them all. Clients only talk to the gateway on port 8080.

| Folder | Port | Owns | Data |
|---|---|---|---|
| `gateway` | 8080 | Routing, CORS, request IDs, timeouts, `/api/health` | none |
| `flight-service` | 3004 | `/api/flights` | `flight_db` + Redis cache |
| `hotel-service` | 3005 | `/api/hotels` | `hotel_db` + Redis cache |
| `car-rental-service` | 3006 | `/api/car-rentals` | `car_rental_db` + Redis cache |
| `activity-service` | 3007 | `/api/activities` | `activity_db` + Redis cache |
| `llm-service` | 3008 | `/api/advice` (LLM travel advice) | `llm_db` |

The gateway's `SEARCH_SERVICE_URL` points at the activity service. Trip, budget and
auth services from the design are not built yet.

## Docs

- Gateway (everything): `gateway/openapi.yaml`
- Each service: `<service>/openapi.yaml`, also served by the service as Swagger UI at
  `http://localhost:<port>/docs` (the ports above are published on `127.0.0.1` for development).

## The CRUD services

Flights, hotels, car rentals, activities and advice all work the same way, so the
code is the same in each folder. Only `src/resource.js` differs: it lists the fields,
filters and sample data, and `src/crud.js` builds the table, validation and routes from it.

| Request | Result |
|---|---|
| `GET /api/<things>` | `200 { count, total, data }`; filters, `sort`, `order`, `limit`, `offset`; `X-Total-Count`; `X-Cache: HIT/MISS` |
| `POST /api/<things>` | `201` + `Location` |
| `GET /api/<things>/:id` | `200` or `404` |
| `PUT /api/<things>/:id` | `200` full replace |
| `PATCH /api/<things>/:id` | `200` partial update |
| `DELETE /api/<things>/:id` | `204` |

Errors are `{ "error": { "code", "message", "details" } }`. Validation errors (`400`) list
every bad field in `details`.

**Cache:** `GET` responses are kept in Redis for 60 s and cleared on any write. If Redis is
down the services just read from PostgreSQL.

**LLM service:** `POST /api/advice` with a `prompt` and no `content` asks Groq for the answer
(`GROQ_API_KEY` in `.env`; model from `LLM_MODEL`). Without a key it saves a placeholder
(`source: "stub"`). A model failure returns `502 LLM_UNAVAILABLE`.

## Changing a service's fields

Edit `src/resource.js`, then update `openapi.yaml` to match. A new column needs a new database:
the table is created only if it does not exist, so run `docker compose down -v` in development
to reset the data.

## Adding a service

Copy a CRUD service folder, change `resource.js`, `PORT`, the name in `package.json` and
`server.js`, add a block to `docker-compose.yml`, a `*_SERVICE_URL` and a rule in the gateway's
`src/config.js` and `src/routes.js`, and a test case in the gateway's tests.
