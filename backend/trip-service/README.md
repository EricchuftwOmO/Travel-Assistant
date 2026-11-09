# Trip Service

The Travel Assistant service for user accounts, trips, and day-by-day itineraries. Users create an account, sign in, manage their own trips, and plan each day of a trip with an ordered list of places. The API keeps each account private: a user can only reach their own profile, trips, and itineraries.

## Key Features

- **Accounts:** register, log in, and view, update, or delete your own account.
- **Trips:** full CRUD for the signed-in user's trips.
- **Search and filtering:** find trips by a keyword in the title, list upcoming or past trips, or combine both.
- **Day-by-day itineraries:** every trip gets one day per date automatically. Add a place at any position, reorder a day, remove one place, or clear a whole day.
- **Places:** browse sample places by city and category to add to an itinerary.
- **Consistent data:** multi-step changes run in database transactions, and a trip cannot be shortened in a way that would delete planned places.
- **Data privacy:** JWT authentication, with every trip query scoped to the signed-in user.
- **Validation and errors:** consistent JSON error responses with meaningful HTTP status codes.
- **API documentation:** an OpenAPI 3 specification with an interactive Swagger UI page.

## Technologies

| Area | Technology |
|---|---|
| Runtime and framework | Node.js, Express 5 |
| Database | PostgreSQL 17, node-postgres (`pg`) |
| Authentication | JSON Web Tokens (`jsonwebtoken`), bcrypt (`bcryptjs`) |
| API documentation | OpenAPI 3, Swagger UI (`swagger-ui-express`) |
| Local database setup | Docker Compose |

## How to Run

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/), which must be running

### With the whole app (recommended)

From the repository root:

```bash
docker compose up --build -d
```

Compose starts the gateway, this service, and the other services. On its first start this service creates the `trip_db` database on the shared PostgreSQL server, then creates the tables from `src/data/schema.sql` and loads the sample data from `src/data/seed.sql`. Later starts keep the existing data.

| Page | URL |
|---|---|
| API base URL (through the gateway) | http://localhost:8080/api |
| This service directly (development only) | http://localhost:3001/api |
| Swagger UI | http://localhost:3001/docs |

Set `JWT_SECRET` in the root `.env` file (copy `.env.example`) to a long random value. Without it, Compose uses a development-only default.

To reset the data, run `docker compose down -v` and start again.

### On its own

You need Node.js 22 or later and a PostgreSQL server.

```bash
cd backend/trip-service
npm install
cp .env.example .env    # Windows PowerShell: Copy-Item .env.example .env
npm run dev
```

Edit `DATABASE_URL` and `JWT_SECRET` in `.env` first. The database named in `DATABASE_URL` is created if it does not exist.

## Sample Accounts

All sample accounts use the password `Password123!`.

| Name | Email | Trips |
|---|---|---|
| Alice Chen | `alice@example.com` | 5 |
| Bob Tanaka | `bob@example.com` | 3 |
| Carol Lopez | `carol@example.com` | 3 |
| David Kim | `david@example.com` | 2 |
| Emma Wilson | `emma@example.com` | 2 |

Alice's Japan Trip (trip 1) and Taiwan Trip (trip 3) already have places planned on their first days, which makes them good starting points for trying the itinerary endpoints.

## Using the API

1. Send `POST /api/auth/login` with an email and password.
2. Copy the `token` from the response.
3. Send `Authorization: Bearer <token>` with each protected request. Tokens expire after 1 hour.

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!"}'

curl "http://localhost:8080/api/trips?search=japan&status=upcoming" \
  -H "Authorization: Bearer <token>"
```

### Endpoints

| Method | Path | Description | Token |
|---|---|---|---|
| POST | `/api/auth/register` | Register an account | No |
| POST | `/api/auth/login` | Log in and receive a token | No |
| GET | `/api/users/me` | Get my account | Yes |
| PUT | `/api/users/me` | Update my name and email | Yes |
| DELETE | `/api/users/me` | Delete my account and trips | Yes |
| POST | `/api/trips` | Create a trip | Yes |
| GET | `/api/trips` | List my trips, with optional `search` and `status` filters | Yes |
| GET | `/api/trips/:tripId` | Get one of my trips | Yes |
| PUT | `/api/trips/:tripId` | Update one of my trips | Yes |
| DELETE | `/api/trips/:tripId` | Delete one of my trips | Yes |
| GET | `/api/trips/:tripId/itineraries` | List a trip's days, with the number of places on each | Yes |
| GET | `/api/trips/:tripId/itineraries/:dayNumber` | Get one day's places in visiting order | Yes |
| POST | `/api/trips/:tripId/itineraries/:dayNumber/items` | Add a place at a position, or at the end | Yes |
| DELETE | `/api/trips/:tripId/itineraries/:dayNumber/items` | Remove every place from a day | Yes |
| PUT | `/api/trips/:tripId/itineraries/:dayNumber/items/order` | Reorder a day's places | Yes |
| GET | `/api/trips/:tripId/itineraries/:dayNumber/items/:itemId` | Get one itinerary item | Yes |
| DELETE | `/api/trips/:tripId/itineraries/:dayNumber/items/:itemId` | Remove one place from a day | Yes |
| GET | `/api/places` | List places, with optional `city` and `category` filters | Yes |

Example: add the place with ID 5 as the second stop of day 1, then put day 1 in a new order:

```bash
curl -X POST http://localhost:8080/api/trips/1/itineraries/1/items \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"placeId":5,"position":2}'

curl -X PUT http://localhost:8080/api/trips/1/itineraries/1/items/order \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"itemIds":[2,15,1]}'
```

The item IDs come from `GET /api/trips/1/itineraries/1`, and `itemIds` must list every item of the day exactly once.

### How Days Follow Trip Dates

- Creating a trip creates one empty day for every date, numbered from 1.
- Changing the start date re-dates every day; the places stay on the same day number.
- Making a trip longer adds empty days at the end.
- Making a trip shorter removes the extra days, but only if they have no places. Otherwise the update returns `409` and nothing changes, so clear those days first.
- A trip can last at most 90 days.

### Status Codes

| Status | `error.code` | Meaning |
|---|---|---|
| 200 / 201 / 204 | | Success, created, or success with no content |
| 400 | `BAD_REQUEST` | Invalid input, such as an unknown `placeId` or a position past the end of the day |
| 401 | `UNAUTHORIZED` | Missing or invalid token, or incorrect login |
| 404 | `NOT_FOUND` | The route, trip, day, or item was not found, including another user's trip |
| 409 | `CONFLICT` | The email is already registered, or new trip dates would remove days that still have places |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

Errors use the same JSON shape as the other services: `{ "error": { "code", "message", "details" } }`. On validation errors, `details` lists each problem.

### HTTP Headers

| Header | Used for |
|---|---|
| `Authorization` | Sends the JWT on protected requests |
| `Content-Type` | Marks request and response bodies as JSON |
| `Location` | Gives the URL of a newly created resource |
| `X-Total-Count` | Custom header with the number of trips, days, or places in a list |
| `WWW-Authenticate` | Names the required scheme on a `401` from a protected route |

## API Documentation

The documentation source is [`docs/openapi.yaml`](docs/openapi.yaml). While the service is running, open http://localhost:3001/docs to browse every endpoint with its parameters, JSON formats, status codes, and examples.

To send requests from that page, log in through `POST /auth/login`, click **Authorize**, and paste the token. The same endpoints are also in the combined gateway spec, `backend/gateway/openapi.yaml`.

## Project Structure

```
backend/trip-service/
├── server.js           # Start-up: prepare the database, then listen
├── openapi.yaml        # OpenAPI specification for this service
├── Dockerfile
└── src/
    ├── app.js          # Express setup: /health, /docs, routes, and error handling
    ├── routes/         # URL-to-controller mapping
    ├── controllers/    # Request handling and HTTP responses
    ├── data/           # Database connection, start-up setup, SQL queries, schema, and seed data
    ├── helpers/        # Validation, authentication, and shared error type
    └── middleware/     # Authentication and error handling
```

A request moves through `route → controller → data → PostgreSQL`. Each service module has its own route, controller, and query files:

- **Users:** registration, login, and the signed-in user's account.
- **Trips:** the trip CRUD operations, search, and status filtering.
- **Itineraries:** a trip's days and the ordered places on each day.
- **Places:** the catalog of places that can be added to a day.

## Data Source

The data in `src/data/seed.sql` is simulated. It contains 5 users, 15 trips, 22 places, 116 itinerary days (one for each date of each trip), and 14 planned itinerary items. The places are well-known landmarks entered by hand with a name, city, and category. No external dataset or real personal data is used.

## Design Notes and Limitations

- Flights, hotels, car rentals, activities, and advice are separate services. Shared trips and expenses are not built yet.
- CORS is handled by the API gateway, so this service does not send CORS headers itself.
- Places come from the sample catalog in the database. There is no Google Places integration yet; the `googlePlaceId` field is reserved for it and is currently empty.
- Each trip has one owner, and trips cannot be shared.
- Deleting an account also deletes that account's trips.
- A trip in progress counts as `upcoming` until its end date has passed, based on the database server's current date.
- Passwords cannot be changed after registration.
