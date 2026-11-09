# Deployment

Everything runs in Docker. Each service has its own `Dockerfile` and `.dockerignore` in its folder under
`backend/` (they all follow the same pattern; `deploy/Dockerfile` is a copy of one for reference), and
`docker-compose.yml` starts the whole system. Evidence of a successful run: `deploy/evidence/docker-run.txt`.

## Build and run with Docker

Run these from the project root (`code/` in the submission zip).

```sh
# 1. (optional) configuration. Without a .env file everything still starts.
cp .env.example .env            # set GROQ_API_KEY to use the real language model

# 2. build every image and start everything (gateway, 5 services, PostgreSQL, Redis)
docker compose up --build -d

# 3. check it
docker compose ps               # every service should say "healthy"
curl http://localhost:8080/health
curl "http://localhost:8080/api/flights?origin=SEA&sort=price"

# logs, stop, reset
docker compose logs -f gateway      # one service's logs
docker compose down                 # stop (data is kept in the pgdata volume)
docker compose down -v              # stop and delete the data (back to the sample data)
```

Build one image by hand (they are all built the same way):

```sh
docker build -t travel-assistant/flight-service backend/flight-service
docker run --rm -p 3004:3004 -e DB_HOST=host.docker.internal travel-assistant/flight-service
```

### Ports

| Service | Port | Reachable from |
|---|---|---|
| gateway | 8080 | everywhere (this is the only port clients use) |
| flight / hotel / car-rental / activity / llm service | 3004 / 3005 / 3006 / 3007 / 3008 | this computer only (`127.0.0.1`), for Swagger UI at `/docs` |
| postgres, redis | 5432, 6379 | inside the Docker network only |

Ports come from environment variables (`PORT`), so a hosting platform can set its own.

## Configuration (environment variables)

No secret is stored in an image, in `docker-compose.yml` or in git. Real values go in `.env` (git-ignored).

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `PORT` | every service | 8080 gateway, 3004 to 3008 services | listen port |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | the five services | `postgres`, 5432, `postgres`, `postgres` | PostgreSQL connection (Compose sets `DB_HOST`) |
| `DB_NAME` | the five services | `flight_db`, `hotel_db`, `car_rental_db`, `activity_db`, `llm_db` | each service's own database (created on first start) |
| `REDIS_URL` | flight, hotel, car-rental, activity | `redis://redis:6379` | GET cache; leave empty to run without a cache |
| `CACHE_TTL_SECONDS` | same | 60 | cache lifetime |
| `GROQ_API_KEY` | llm-service | empty | language model key. **Empty = placeholder answers** (`source: "stub"`), everything else works |
| `LLM_MODEL` | llm-service | `openai/gpt-oss-20b` | Groq model |
| `FLIGHT_SERVICE_URL`, `HOTEL_SERVICE_URL`, `ACTIVITY_SERVICE_URL` | llm-service | Compose service names | where the recommendation endpoint finds the services it calls |
| `*_SERVICE_URL`, `CORS_ORIGINS`, `UPSTREAM_TIMEOUT_MS`, `LLM_TIMEOUT_MS` | gateway | see `backend/gateway/.env.example` | routing table, CORS, timeouts |

## Cloud deployment preparation (Render)

Not deployed yet; a deployed API is encouraged but not required for Phase II, and is planned for Phase III.

**Platform.** [Render](https://render.com) runs Docker images straight from a Git repository, offers managed
PostgreSQL and a managed Redis-compatible key-value store, and lets services reach each other by name on a
private network. That matches this project: one Dockerfile per service.

**Steps** (each step is done in the Render dashboard):

1. Push the repository to GitHub and connect it to Render.
2. Create a **PostgreSQL** instance and a **Key Value** (Redis) instance in the same region.
3. For each of `flight-service`, `hotel-service`, `car-rental-service`, `activity-service`, `llm-service`
   create a **Private Service** with *Runtime: Docker*, *Dockerfile path* `backend/<service>/Dockerfile`
   and *Root directory* `backend/<service>`. Set the variables above (`DB_HOST`, `DB_USER`, `DB_PASSWORD`
   from the PostgreSQL instance, `REDIS_URL` from the Key Value instance, `GROQ_API_KEY` as a secret).
4. Create the **gateway** as a **Web Service** (the only public one, Dockerfile `backend/gateway/Dockerfile`)
   and point each `*_SERVICE_URL` at the matching private service's internal address and port.
5. The platform's health check path is `/health`, which every service already serves.
6. Test with `curl https://<gateway-name>.onrender.com/api/flights` and the Postman collection
   (change its `baseUrl` variable to the deployed URL).

**Known work for the real deployment (Phase III):**
- Render sets its own `PORT`; the services read `PORT`, but the gateway's `*_SERVICE_URL` values must use
  whatever port each private service ends up on.
- Each service currently runs `CREATE DATABASE` on its first start. On a managed PostgreSQL the database
  user may not be allowed to do that, so the Phase III change is to create the five databases in the
  dashboard and add a setting that skips the create step.
- Deployed URL and a sample request will be added here once the deployment exists.
