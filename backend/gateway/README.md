# API Gateway

The single entry point for the Travel Assistant frontend. It forwards every `/api/*`
request to the service that owns it and adds the cross-cutting pieces from the
Phase II design: CORS, `X-Request-Id` tracing, timeouts, uniform errors and a
combined health check. It has no business logic and no database access.

## Routing

The first matching rule wins:

| Path | Service | Default URL | Timeout |
|---|---|---|---|
| `/api/trips/:tripId/budget` | Budget | `http://localhost:3003` | 5 s |
| `/api/trips`, `/api/trips/*` | Trip | `http://localhost:3001` | 5 s |
| `/api/activities/*` | Activity Search | `http://localhost:3002` | 5 s |
| `/api/budget/*` | Budget | `http://localhost:3003` | 5 s |
| `/api/planner/*` | AI Planner (stretch) | not set, so not routed | 60 s |

Forwarding uses [`http-proxy-middleware`](https://github.com/chimurai/http-proxy-middleware)
with keep-alive connections to each service. Paths, query strings, methods, headers and
bodies are forwarded unchanged. Bodies are streamed, not parsed. Each service therefore defines its routes with the full `/api/...` path.

## What the gateway adds

- **`X-Request-Id`**: a valid ID from the client is kept; otherwise a UUID is created.
  It is sent to the service and returned to the client, and it appears in the logs.
- **`X-Forwarded-For` / `-Host` / `-Proto`**: the original client details, for the services.
- **CORS**: only for origins in `CORS_ORIGINS`. Preflight `OPTIONS` requests are answered by
  the gateway and never reach a service.
- **Errors** in the shared format `{ "error": { "code", "message" } }`:

| Status | Code | When |
|---|---|---|
| 404 | `NOT_FOUND` | No service owns the path |
| 502 | `UPSTREAM_UNAVAILABLE` | The service is down or refused the connection |
| 504 | `UPSTREAM_TIMEOUT` | The service sent nothing for the whole timeout (5 s, or 60 s for the planner) |
| 500 | `INTERNAL_ERROR` | Unexpected gateway error (no stack trace returned) |

  Errors returned by a service (400, 404, 422, …) are passed through unchanged.

## Health checks

- `GET /health`: the gateway's own liveness check, used by the Docker `HEALTHCHECK`.
- `GET /api/health`: calls `SERVICE_HEALTH_PATH` (default `/health`) on every configured
  service. It returns **200** `status: "ok"` if all are up, otherwise **503** `status: "degraded"`
  with the state of each service:

```json
{
  "status": "degraded",
  "services": {
    "trip":   { "status": "up", "httpStatus": 200, "latencyMs": 4 },
    "search": { "status": "down", "reason": "unreachable", "latencyMs": 1 },
    "budget": { "status": "up", "httpStatus": 200, "latencyMs": 3 }
  }
}
```

**Every service must serve `GET /health`** (200 when healthy) for this check to work.

## Running

```bash
cd backend/gateway
npm install
cp .env.example .env     # optional; the defaults work for local runs
npm start                # or: npm run dev (restarts when files change)
npm test
```

With Docker:

```bash
docker build -t ta-gateway backend/gateway
docker run --rm -p 8080:8080 \
  -e TRIP_SERVICE_URL=http://host.docker.internal:3001 ta-gateway
```

In `docker-compose.yml` the gateway is the only service with a published port. Set each
`*_SERVICE_URL` to the Compose service name, for example `http://trip-service:3001`.

## Configuration

See [`.env.example`](.env.example) for every variable and its default.

## Layout

```
server.js           entry point: loads config, starts the server
src/config.js       environment variables and defaults
src/routes.js       route table (which service owns which path)
src/proxy.js        one http-proxy-middleware proxy per route; 502/504 errors
src/middleware.js   request IDs, CORS, request logging
src/health.js       combined health check
src/errors.js       uniform JSON errors
test/               tests using stub services (node:test, no extra dependencies)
```
