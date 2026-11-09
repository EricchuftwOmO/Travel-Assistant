# API Gateway

The single entry point for clients. It checks the login token, forwards each `/api/*` request to the service
that owns it, and adds CORS, `X-Request-Id`, timeouts and uniform errors. It has no database and no business logic.

## Routing

The first matching rule wins (`src/routes.js`). Paths, queries, methods and bodies are forwarded unchanged.

| Path | Service | Timeout |
|---|---|---|
| `/api/trips/:id/budget`, `/api/budget/*` | Budget (planned) | 5 s |
| `/api/trips/*`, `/api/auth/*`, `/api/users/*`, `/api/places` | Trip | 5 s |
| `/api/activities/*` | Activity | 5 s |
| `/api/flights/*` | Flight | 5 s |
| `/api/hotels/*` | Hotel | 5 s |
| `/api/car-rentals/*` | Car Rental | 5 s |
| `/api/advice/*` | LLM | 40 s |
| `/api/planner/*` | AI Planner (not routed unless a URL is set) | 60 s |

## Login check (`src/auth.js`)

Verifies the bearer JWT (HS256, `JWT_SECRET`, expiry). Public without a token: `POST /api/auth/register`,
`POST /api/auth/login`, `/health`, `/api/health`, and `GET` on flights, hotels, car rentals and activities.
Anything else without a valid token gets `401 UNAUTHORIZED`. The user id is forwarded as `X-User-Id`;
a client-sent `X-User-Id` is removed.

## Other behavior

- **`X-Request-Id`**: a valid client value is kept, otherwise a UUID is made. It goes to the service, the response and the logs.
- **CORS**: only for `CORS_ORIGINS`. Preflight requests are answered by the gateway.
- **Errors** are `{ "error": { "code", "message" } }`. Errors from a service pass through unchanged.

| Status | Code | When |
|---|---|---|
| 401 | `UNAUTHORIZED` | missing or invalid token |
| 404 | `NOT_FOUND` | no service owns the path |
| 502 | `UPSTREAM_UNAVAILABLE` | service is down |
| 504 | `UPSTREAM_TIMEOUT` | service did not answer in time |
| 500 | `INTERNAL_ERROR` | unexpected gateway error |

## Health

- `GET /health`: the gateway's own check (used by Docker).
- `GET /api/health`: calls `/health` on every configured service. `200 "ok"` if all are up, otherwise `503 "degraded"`
  with the status of each.

## Run

```sh
cd backend/gateway
npm install
npm start        # defaults work locally; see .env.example
npm test         # 15 tests with stub services
```

In `docker-compose.yml` the gateway is the only service with a public port.

## Layout

```
server.js           starts the server
src/config.js       environment variables
src/routes.js       route table
src/auth.js         login check
src/proxy.js        proxy per route, 502/504 errors
src/middleware.js   request IDs, CORS, logging
src/health.js       combined health check
src/errors.js       JSON errors
test/               node:test tests
```
