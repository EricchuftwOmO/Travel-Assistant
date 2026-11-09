# Travel Assistant: Phase II backend

TCSS 559 Autumn 2026. A travel-planning backend made of small services behind an API gateway, all run with Docker.

- **Trip service**: accounts (login), trips, day-by-day itineraries, places.
- **Flight, hotel, car-rental and activity services**: CRUD, filters, PostgreSQL, Redis cache.
- **LLM service** (the AI part): saves travel advice and builds trip recommendations.
- **API gateway**: single entry point on port 8080. Checks the login token and routes each request.

## Run

Needs Docker with Compose.

```sh
docker compose up --build -d     # build and start everything
docker compose ps                # wait until all show "healthy" (about 15 s)
curl http://localhost:8080/health
```

`GET /api/health` returns 503 "degraded" on purpose: the Budget service is planned, not built yet.

Stop with `docker compose down` (keeps data) or `docker compose down -v` (back to sample data).
Ports and environment variables: [`deploy/DEPLOY.md`](deploy/DEPLOY.md).

**Optional:** `cp .env.example .env` and set `GROQ_API_KEY` for real model answers. Without it the LLM service
saves placeholder answers (`"source": "stub"`) and picks with simple rules. `.env` is git-ignored.

## Try it

All requests go through the gateway. Swagger UI: `http://localhost:3001/docs` (trips), `3004` flights, `3005` hotels,
`3006` car rentals, `3007` activities, `3008` advice. Full API: [`backend/gateway/openapi.yaml`](backend/gateway/openapi.yaml).

**Login:** every route needs `Authorization: Bearer <token>` except register, login, health and reading
flights, hotels, car rentals and activities. Get a token with the sample user:

```sh
curl -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!"}'
```

| Resource | Path | Filters |
|---|---|---|
| Accounts | `/api/auth/register`, `/api/auth/login`, `/api/users/me` | |
| Trips and itineraries | `/api/trips`, `/api/trips/{id}/itineraries/{day}/items` | title, upcoming, past |
| Places | `/api/places` | `city`, `category` |
| Flights | `/api/flights` | `origin`, `destination`, `departDate`, `maxPrice` |
| Hotels | `/api/hotels` | `city`, `country`, `minStars`, `maxPrice`, `available` |
| Car rentals | `/api/car-rentals` | `city`, `carType`, `minSeats`, `maxPrice`, `available` |
| Activities | `/api/activities` | `city`, `category`, `maxPrice`, `q` |
| Advice | `/api/advice` | `userId`, `tripId`, `topic` |

Flights, hotels, car rentals, activities and advice support `GET`, `POST`, `GET/PUT/PATCH/DELETE /{id}`, plus
`sort`, `order`, `limit`, `offset`. Errors look like `{ "error": { "code", "message", "details" } }`.

```sh
curl "http://localhost:8080/api/hotels?city=Tokyo&minStars=4&maxPrice=200"

# recommendation: the LLM service calls the other services, adds up the cost in code, and saves the result
TOKEN=<token from login>
curl -X POST http://localhost:8080/api/advice/recommendations -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"u1","origin":"SEA","destination":"Tokyo","nights":5,"travelers":1,"budget":2500}'
```

## Test

```sh
# Postman collection (needs the stack running): 41 requests, 93 assertions
npx newman run tests/postman/Travel-Assistant.postman_collection.json -e tests/postman/local.postman_environment.json

# Unit tests (Node 22+, no database needed)
(cd backend/gateway && npm install && npm test)        # 15 tests
(cd backend/llm-service && npm install && npm test)    # 13 tests
```

A recorded run is in [`tests/results/newman-run.txt`](tests/results/newman-run.txt).

## Data

Each service creates its own database and sample rows on first start (six databases, one PostgreSQL server).
SQL exports are in [`data/`](data/README.md).

## Layout

```
backend/        gateway, trip-service, flight/hotel/car-rental/activity-service, llm-service
docker-compose.yml
data/           SQL exports of the six databases
tests/          Postman collection and recorded run
deploy/         deployment guide and Docker evidence
docs/ARCHITECTURE.md
```

## Planned for Phase III

Trip members, shared expenses and settlements (Budget service), live flight and hotel data from SerpApi,
the React frontend, Google Places, cloud deployment.

## Design

Architecture, API, data model, mockups and the AI workflow are in the design document (`GroupName_PhaseII.pdf`).
The LLM service is the AI component: it calls the flight, hotel and activity services, lets the model pick from
their results, and computes the cost itself. Prices and ids always come from the services, never the model.
