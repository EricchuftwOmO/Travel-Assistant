# Travel Assistant

TCSS 559 Autumn 2026. A travel-planning app: a React frontend and small services behind an API gateway, all run with Docker.

- **Frontend** (`frontend/`, React + Vite): Flight Search, My Trips, Trip Details (Overview + Day tabs), My Profile and an AI assistant box. It talks only to the gateway's GraphQL API.
- **User service**: accounts, login, Sign in with Google and profiles, as a **REST** API. The only service that handles tokens.
- **Trip service**: trips, flights attached to trips, day-by-day itineraries, places.
- **Flight, hotel, car-rental and activity services**: CRUD, filters, PostgreSQL, Redis cache.
- **LLM service** (the AI part): saves travel advice and builds trip recommendations.
- **API gateway**: single entry point on port 8080. Serves the **GraphQL** API the frontend uses, asks the user service to check login tokens, and routes REST requests.

## Run

Needs Docker with Compose.

```sh
docker compose up --build -d     # build and start everything
docker compose ps                # wait until all show "healthy" (about 15 s)
curl http://localhost:8080/health
```

Then open the app at **http://localhost:5173** and log in as `alice@example.com` / `Password123!`.

To work on the frontend with hot reload instead: `cd frontend && npm install && npm run dev` (the backend still runs in Docker).

> Upgrading from an older checkout? Accounts moved out of `trip_db` into the new `user_db`, so reset the sample data once with `docker compose down -v`.

`GET /api/health` returns 503 "degraded" on purpose: the Budget service is planned, not built yet.

Stop with `docker compose down` (keeps data) or `docker compose down -v` (back to sample data).
Ports and environment variables: [`deploy/DEPLOY.md`](deploy/DEPLOY.md).

**Optional:** `cp .env.example .env` and set `GROQ_API_KEY` for real model answers. Without it the LLM service
answers questions with travel jokes (`"source": "stub"`) and picks with simple rules. `.env` is git-ignored.

**Optional:** set `SERPAPI_API_KEY` (from serpapi.com) for live Google Flights results when a search has from, to and a
future date. Then: `docker compose up -d flight-service`. Without it, Flight Search uses the stored catalog.

**Optional:** set `GOOGLE_PLACES_API_KEY` (a Google Cloud key with **Places API (New)** and **Maps JavaScript API**
enabled) to pick places on a Google map in Add place. Then rebuild: `docker compose up --build -d trip-service frontend`.
Without it, Add place uses the sample place list.

## Try it

All requests go through the gateway; the other services are private to the Docker network. To browse a service's Swagger UI, start with
`docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build`: `http://localhost:3009/docs` (accounts), `3001` trips, `3004` flights,
`3005` hotels, `3006` car rentals, `3007` activities, `3008` advice. Full API: [`backend/gateway/openapi.yaml`](backend/gateway/openapi.yaml).

**Login:** every route needs `Authorization: Bearer <token>` except register, login, Google sign-in, health and reading
flights, hotels, car rentals and activities. The gateway checks the token with the user service. Get a token with the sample user:

```sh
curl -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!"}'
```

| Resource | Path | Filters |
|---|---|---|
| Accounts and profile (GraphQL, what the frontend uses) | `POST /api/graphql` (or `/graphql`): `me`, `register`, `login`, `loginWithGoogle`, `updateBasicInfo`, `updateLanguageSettings`, `updateTravelPreferences`, `deleteMe` | |
| Accounts (REST, user service) | `/api/auth/register`, `/api/auth/login`, `/api/auth/google`, `/api/users/me` | |
| Trips, flights on trips, itineraries, places, advice (GraphQL, what the frontend uses) | `myTrips`, `trip`, `itineraryDay`, `createTrip`, `updateTrip`, `deleteTrip`, `attachFlight`, `detachFlight`, `addItineraryItem`, `reorderItineraryItems`, `removeItineraryItem`, `places`, `nearbyPlaces`, `locatePlace`, `myAdvice`, `askAdvice`, `flights` (see `backend/gateway/README.md`) | |
| Trips and itineraries (REST) | `/api/trips`, `/api/trips/{id}/itineraries/{day}/items` | title, upcoming, past |
| Trip flights | `/api/trips/{id}/flights` (`POST { flightId }`), or `flightId` when creating a trip | |
| Places (sample catalog) | `/api/places` | `city`, `category` |
| Places (Google) | `/api/places/nearby`, `/api/places/locate` | `lat`, `lng`, `radius`, `category` |
| Flights | `/api/flights` | `origin`, `destination`, `departDate`, `maxPrice` |
| Hotels | `/api/hotels` | `city`, `country`, `minStars`, `maxPrice`, `available` |
| Car rentals | `/api/car-rentals` | `city`, `carType`, `minSeats`, `maxPrice`, `available` |
| Activities | `/api/activities` | `city`, `category`, `maxPrice`, `q` |
| Advice | `/api/advice` | `userId`, `tripId`, `topic` |

Flights, hotels, car rentals, activities and advice support `GET`, `POST`, `GET/PUT/PATCH/DELETE /{id}`, plus
`sort`, `order`, `limit`, `offset`. Errors look like `{ "error": { "code", "message", "details" } }`.

```sh
# GraphQL: who am I?
curl -X POST http://localhost:8080/api/graphql -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"query":"{ me { id name email } }"}'

curl "http://localhost:8080/api/hotels?city=Tokyo&minStars=4&maxPrice=200"

# recommendation: the LLM service calls the other services, adds up the cost in code, and saves the result
TOKEN=<token from login>
curl -X POST http://localhost:8080/api/advice/recommendations -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"u1","origin":"SEA","destination":"Tokyo","nights":5,"travelers":1,"budget":2500}'
```

## Test

```sh
# Postman collection (needs the stack running): 78 requests, 162 assertions (Google cases pass with or without a key)
npx newman run tests/Travel-Assistant.postman_collection.json -e tests/local.postman_environment.json

# Unit tests (Node 22+, no database needed)
(cd backend/gateway && npm install && npm test)        # 42 tests
(cd backend/llm-service && npm install && npm test)    # 13 tests
(cd backend/user-service && npm install && npm test)   # REST routes, Google sign-in and profile validation
(cd backend/trip-service && npm install && npm test)   # 7 tests (Google Places client, fetch mocked)
```

## Data

Each service creates its own database and sample rows on first start (seven databases, one PostgreSQL server).
SQL exports are in [`data/`](data/README.md).

## Layout

```
frontend/       React app (Vite); Dockerfile serves it with nginx on port 5173
backend/        gateway, user-service, trip-service, flight/hotel/car-rental/activity-service, llm-service
docker-compose.yml
data/           SQL exports of the six databases
tests/          Postman collection and environment (import into Postman)
deploy/         deployment guide and a reference Dockerfile
docs/ARCHITECTURE.md
```

## Planned for Phase III

Trip members, shared expenses and settlements, live flight and hotel data from SerpApi,
Google Places and a map on the Day tabs, cloud deployment.

## Design

Architecture, API, data model, mockups and the AI workflow are in the design document (`GroupName_PhaseII.pdf`).
The LLM service is the AI component: it calls the flight, hotel and activity services, lets the model pick from
their results, and computes the cost itself. Prices and ids always come from the services, never the model.
