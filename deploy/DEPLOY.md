# Deployment

Everything runs in Docker. Each service has its own `Dockerfile` and `.dockerignore` under `backend/`
(`deploy/Dockerfile` is a copy of one for reference). `docker-compose.yml` starts the whole system.

## Build and run

Run from the project root.

```sh
cp .env.example .env            # optional; set GROQ_API_KEY for the real model
docker compose up --build -d    # gateway, 6 services, PostgreSQL, Redis
docker compose ps               # every service should say "healthy"
curl http://localhost:8080/health
curl "http://localhost:8080/api/flights?origin=SEA&sort=price"

docker compose logs -f gateway  # logs of one service
docker compose down             # stop (data kept in the pgdata volume)
docker compose down -v          # stop and delete data (back to sample data)
```

## Ports

| Service | Port | Reachable from |
|---|---|---|
| gateway | 8080 | everywhere (the only port clients use) |
| trip / flight / hotel / car-rental / activity / llm | 3001 / 3004 / 3005 / 3006 / 3007 / 3008 | this computer only (`127.0.0.1`), for Swagger UI at `/docs` |
| postgres, redis | 5432, 6379 | inside the Docker network |

## Configuration

No secret is stored in an image, `docker-compose.yml` or git. Real values go in `.env` (git-ignored).

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `PORT` | every service | 8080 gateway, 3001 trip, 3004 to 3008 others | listen port |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | flight, hotel, car-rental, activity, llm | `postgres`, 5432, `postgres`, `postgres` | PostgreSQL connection |
| `DB_NAME` | same five | `flight_db`, `hotel_db`, `car_rental_db`, `activity_db`, `llm_db` | each service's database (created on first start) |
| `DATABASE_URL` | trip-service | `postgres://postgres:postgres@postgres:5432/trip_db` | trip service connection |
| `JWT_SECRET` | trip-service, gateway | development default | signs and checks login tokens; both must match. **Set a long random value** |
| `REDIS_URL` | flight, hotel, car-rental, activity | `redis://redis:6379` | GET cache; empty = no cache |
| `CACHE_TTL_SECONDS` | same | 60 | cache lifetime |
| `GROQ_API_KEY` | llm-service | empty | model key; empty = placeholder answers |
| `LLM_MODEL` | llm-service | `openai/gpt-oss-20b` | Groq model |
| `FLIGHT_SERVICE_URL`, `HOTEL_SERVICE_URL`, `ACTIVITY_SERVICE_URL`, `CAR_RENTAL_SERVICE_URL` | llm-service | Compose names | services the recommendation endpoint calls |
| `*_SERVICE_URL`, `CORS_ORIGINS`, `UPSTREAM_TIMEOUT_MS`, `LLM_TIMEOUT_MS` | gateway | see `backend/gateway/.env.example` | routing, CORS, timeouts |

## Cloud deployment (Render, planned for Phase III)

Not deployed yet. Render runs Docker images from Git, has managed PostgreSQL and Redis-compatible storage, and
gives services a private network.

1. Push the repository to GitHub and connect it to Render.
2. Create a PostgreSQL instance and a Key Value (Redis) instance in the same region.
3. For each of the six services, create a Private Service (Docker, Dockerfile `backend/<service>/Dockerfile`)
   and set its variables from the table above (`JWT_SECRET` and `GROQ_API_KEY` as secrets).
4. Create the gateway as a Web Service (the only public one), with each `*_SERVICE_URL` pointing at the matching
   private service, and the same `JWT_SECRET`.
5. Health check path: `/health` (every service has it).
6. Test with `curl https://<gateway-name>.onrender.com/api/flights` and the Postman collection (change `baseUrl`).

Known work: use each service's real private port in the `*_SERVICE_URL` values, and add a setting to skip
`CREATE DATABASE` on first start, since managed PostgreSQL may not allow it.
