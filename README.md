# Travel Assistant: Phase II backend

TCSS 559 Autumn 2026, project Phase II. A travel-planning backend: a **trip service** (accounts with login,
trips, day-by-day itineraries, a places catalog), **flights, hotels, car rentals and activities** (each its own
Express service with its own PostgreSQL database and Redis cache), an **LLM service** that saves travel advice
and builds **recommendation summaries**, and an **API gateway** in front of them. Everything runs in Docker.

> In the submission zip the commands below are run from the `code/` folder (the project root).
> `data/`, `tests/` and `deploy/` sit next to it; links point there.

## What is done and what is planned

| Done in Phase II (implemented and tested) | Planned for Phase III |
|---|---|
| API gateway: routing, CORS, `X-Request-Id`, timeouts, uniform errors, combined health check | Trip members, shared expenses and settlements (the rest of the 9-table Travel database) |
| **Trip service**: register and login (JWT), own profile, trips CRUD with search, one itinerary day per trip date, add/reorder/remove places, places catalog | Budget service (trip cost, settlements) |
| Flight, Hotel, Car Rental, Activity services: full CRUD, filtering, sorting, paging, validation, Redis cache | Authentication in front of the other services (today only the trip service checks tokens) |
| LLM service: advice CRUD, **LLM-written advice**, and **`POST /api/advice/recommendations`** (calls the Flight, Hotel and Activity services, picks a package, adds up the cost in code, saves the summary) | Live flight and hotel data from SerpApi (Google Flights / Google Hotels) |
| One PostgreSQL database per service (six); data persists across restarts | React frontend (mockups are in the design document) |
| OpenAPI 3.1 documents + Swagger UI | Cloud deployment (preparation notes in [`deploy/DEPLOY.md`](deploy/DEPLOY.md)) |
| Automated tests (gateway 12, LLM service 13) and a Postman collection (40 requests, 90 assertions) | Settlement endpoint, Google Places |

## Run it

Needs Docker (with Compose). Nothing else is installed on your computer.

```sh
docker compose up --build -d        # builds 7 images, starts gateway, 6 services, PostgreSQL, Redis
docker compose ps                   # wait until every service says "healthy" (about 15 s)
curl http://localhost:8080/health
```

`GET /api/health` answers **503 "degraded"** on purpose: it also checks the Budget service, which is planned and
not built yet. Every service built so far (trip, flight, hotel, car rental, activity, llm) must show `up`.

Stop: `docker compose down` (data kept) or `docker compose down -v` (back to the sample data).
More Docker commands, ports and the environment variables: [`deploy/DEPLOY.md`](deploy/DEPLOY.md).

### Configuration

Everything has a default, so a `.env` file is optional. To use the real language model:

```sh
cp .env.example .env     # then set GROQ_API_KEY=...
docker compose up --build -d
```

Without `GROQ_API_KEY` the LLM service stores clearly labelled placeholder answers (`"source": "stub"`) and the
recommendation endpoint picks with plain rules. `.env` is git-ignored; no key is stored in any image or file.

### Database

Each service creates its own database and tables on first start and loads sample rows
(`trip_db`, `flight_db`, `hotel_db`, `car_rental_db`, `activity_db`, `llm_db`, all on one PostgreSQL server).
Exports of that data and how to load them by hand: [`data/README.md`](data/README.md).

```sh
docker compose exec postgres psql -U postgres -d flight_db -c "SELECT id, airline, origin, destination, price FROM flights"
```

## Try the API

All requests go through the gateway on port 8080. Swagger UI for each service: `http://localhost:3001/docs`
(trips), `3004` flights, `3005` hotels, `3006` car rentals, `3007` activities, `3008` advice. The full contract for the gateway is
[`backend/gateway/openapi.yaml`](backend/gateway/openapi.yaml).

| Resource | Path | Filters |
|---|---|---|
| Accounts (trip service) | `POST /api/auth/register`, `POST /api/auth/login`, `GET/PUT/DELETE /api/users/me` | needs `Authorization: Bearer <token>` except register and login |
| Trips and itineraries (trip service) | `/api/trips`, `/api/trips/{id}/itineraries/{day}/items` | trip search by title, upcoming or past; token required |
| Places (trip service) | `/api/places` | `city`, `category`; token required |
| Flights | `/api/flights` | `origin`, `destination`, `departDate`, `maxPrice` |
| Hotels | `/api/hotels` | `city`, `country`, `minStars`, `maxPrice`, `available` |
| Car rentals | `/api/car-rentals` | `city`, `carType`, `minSeats`, `maxPrice`, `available` |
| Activities | `/api/activities` | `city`, `category`, `maxPrice`, `q` |
| Advice | `/api/advice` | `userId`, `tripId`, `topic` |

Each supports `GET` (list), `POST`, `GET /{id}`, `PUT /{id}`, `PATCH /{id}`, `DELETE /{id}`, plus `sort`, `order`,
`limit`, `offset`. Errors are always `{ "error": { "code", "message", "details" } }`.

```sh
# search
curl "http://localhost:8080/api/hotels?city=Tokyo&minStars=4&maxPrice=200"

# create (201 + Location), then an invalid one (400 listing every bad field)
curl -X POST http://localhost:8080/api/flights -H "Content-Type: application/json" \
  -d '{"airline":"ANA","flight_number":"NH 177","origin":"SEA","destination":"HND","depart_at":"2027-01-28T19:40:00Z","arrive_at":"2027-01-30T00:10:00Z","price":912}'
curl -X POST http://localhost:8080/api/flights -H "Content-Type: application/json" -d '{"price":-5}'

# the application-specific operation: a trip recommendation (calls the other services, costs it in code, saves it)
curl -X POST http://localhost:8080/api/advice/recommendations -H "Content-Type: application/json" \
  -d '{"user_id":"u1","origin":"SEA","destination":"Tokyo","nights":5,"travelers":1,"budget":2500}'
```

## Test it

```sh
# 1. Postman collection (40 requests, 90 assertions). Needs the stack running. Import
#    tests/postman/Travel-Assistant.postman_collection.json into Postman, or run it from the command line:
npx newman run tests/postman/Travel-Assistant.postman_collection.json -e tests/postman/local.postman_environment.json

# 2. Unit and route tests (Node 22+; no database, Redis or API key needed)
(cd backend/gateway && npm install && npm test)        # 12 tests: routing, proxying, errors, health
(cd backend/llm-service && npm install && npm test)    # 13 tests: validation, costing, selection, the recommendation route
```

A recorded run of the collection is in [`tests/results/newman-run.txt`](tests/results/newman-run.txt). It covers
CRUD, filters, `404`, validation `400`s, advice, the trip service (login, `401`, trips, itinerary days), and the recommendation endpoint (within budget, over budget,
two travelers, invalid input, unknown destination). `502` (a search service down) is covered by the LLM service tests.

## Project layout

```
backend/
  gateway/                 routing, CORS, request IDs, timeouts, combined health; openapi.yaml
  trip-service/            accounts (JWT), trips, itineraries, places; hand-written, own README and openapi.yaml
  flight-service/          each CRUD service has the same layout:
  hotel-service/             server.js            start-up
  car-rental-service/        src/resource.js      fields, filters, sample data (the only file that differs)
  activity-service/          src/crud.js          generic CRUD routes and validation
  llm-service/               src/llm.js           advice written by the model
                             src/recommend.js     recommendation summary (business logic)
                             openapi.yaml, Dockerfile, .dockerignore, .env.example, package.json
docker-compose.yml         the whole system
data/                      SQL exports of the six databases + how to load them
tests/                     Postman collection, environment, recorded run
deploy/                    deployment guide, Docker evidence
docs/ARCHITECTURE.md       architecture diagrams
```

## Design

Architecture, API specification, data model, mockups and the AI workflow are in the Phase II design document
(`GroupName_PhaseII.pdf`). Short version: the **trip service** keeps users' trips and itineraries, and the **LLM service is the AI component**. It calls the Flight, Hotel and
Activity services directly, lets the language model choose among their results, adds up the cost itself, and
saves the summary. Prices and ids always come from the services, never from the model.
