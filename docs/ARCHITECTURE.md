# Travel Assistant: architecture (current state)

Diagrams are [Mermaid](https://mermaid.js.org/) and render on GitHub. Dashed boxes are planned, not built.

## 1. Services

```mermaid
flowchart TB
    client["CLIENT<br/>React app :5173"]
    gateway["API GATEWAY :8080<br/>GraphQL API · login check via user service · routing · CORS · X-Request-Id · timeouts · /api/health"]

    client --> gateway

    subgraph planned["Planned, not built yet"]
        direction LR
        budget["BUDGET SERVICE :3003"]:::planned
    end

    user["USER SERVICE :3009<br/>/api/auth (incl. Google) · /api/users (REST)<br/>(signs and validates JWTs)"]
    trip["TRIP SERVICE :3001<br/>/api/trips (+ flights, itineraries) · /api/places<br/>(trusts X-User-Id from the gateway)"]

    gateway -->|"/api/auth, /api/users, GraphQL accounts"| user
    gateway -->|"every protected request: GET /api/auth/validate"| user
    gateway -->|"/api/trips, /api/places"| trip
    user -->|"delete account: DELETE /internal/my-data"| trip
    trip -->|"attach flight: GET /api/flights/:id"| flight
    gateway -.->|"/api/budget"| budget

    subgraph search["Search services (PostgreSQL + Redis cache)"]
        flight["FLIGHT SERVICE :3004<br/>/api/flights"]
        hotel["HOTEL SERVICE :3005<br/>/api/hotels"]
        car["CAR RENTAL SERVICE :3006<br/>/api/car-rentals"]
        activity["ACTIVITY SERVICE :3007<br/>/api/activities"]
    end

    llm["LLM SERVICE :3008<br/>/api/advice<br/>(Advice)"]

    gateway -->|"/api/flights"| flight
    gateway -->|"/api/hotels"| hotel
    gateway -->|"/api/car-rentals"| car
    gateway -->|"/api/activities"| activity
    gateway -->|"/api/advice (40 s timeout)"| llm

    subgraph pg["PostgreSQL server (one database per service)"]
        fdb[("flight_db")]
        hdb[("hotel_db")]
        cdb[("car_rental_db")]
        adb[("activity_db")]
        ldb[("llm_db")]
        tdb[("trip_db")]
    end

    redis[("REDIS<br/>GET cache, keys prefixed per service")]

    flight --> fdb
    hotel --> hdb
    car --> cdb
    activity --> adb
    llm --> ldb
    trip --> tdb

    flight -.-> redis
    hotel -.-> redis
    car -.-> redis
    activity -.-> redis

    groq["GROQ API<br/>(language model)"]
    llm -->|"if GROQ_API_KEY is set"| groq

    serpapi["SERPAPI<br/>(external, planned)"]:::planned
    flight -.->|"planned: live results"| serpapi
    hotel -.->|"planned: live results"| serpapi

    llm -->|"search_flights tool"| flight
    llm -->|"pre-trip notes"| user
    llm -->|"pre-trip notes"| trip

    classDef planned stroke-dasharray: 5 5,fill:#f4f4f4,color:#666
```

Dotted arrows to Redis mean the cache is optional: if Redis is down, the services read
from PostgreSQL instead.

**The AI component is the LLM service.** It has two chains, and calls other services directly (not through the gateway):
- **Pre-trip notes (fixed chain):** the code reads the traveler from the User service and the trip from the Trip
  service, checks the plan, asks Groq once (no tools) for JSON notes and checks them. Nothing is saved.
- **AI assistant (tool-calling chain):** Groq decides whether to call `search_flights` (the Flight service), at most
  twice per question; the answer is saved in `llm_db`.

## 2. Containers and ports

| Container | Image / folder | Port | Published | Depends on |
|---|---|---|---|---|
| `gateway` | `backend/gateway` | 8080 | `8080` (all clients) | none (answers 502 if a service is down) |
| `frontend` | `frontend` (nginx) | 80 | `5173` | gateway |
| `user-service` | `backend/user-service` | 3009 | no (dev override only) | postgres (healthy) |
| `trip-service` | `backend/trip-service` | 3001 | no (dev override only) | postgres (healthy) |
| `flight-service` | `backend/flight-service` | 3004 | no (dev override only) | postgres (healthy), redis |
| `hotel-service` | `backend/hotel-service` | 3005 | no (dev override only) | postgres (healthy), redis |
| `car-rental-service` | `backend/car-rental-service` | 3006 | no (dev override only) | postgres (healthy), redis |
| `activity-service` | `backend/activity-service` | 3007 | no (dev override only) | postgres (healthy), redis |
| `llm-service` | `backend/llm-service` | 3008 | no (dev override only) | postgres (healthy) |
| `postgres` | `postgres:16` | 5432 | no | none |
| `redis` | `redis:7-alpine` | 6379 | no | none |

Only the gateway and the web app publish ports. Every other service is private to the Docker network.
`docker-compose.dev.yml` is an optional override that opens them on `127.0.0.1` so each service's Swagger UI
(`/docs`) can be browsed during development.

## 3. A cached read (flights, hotels, car rentals, activities)

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant S as Flight Service
    participant R as Redis
    participant P as PostgreSQL

    C->>G: GET /api/flights?origin=SEA
    G->>S: forward unchanged (+ X-Request-Id)
    S->>R: look up cached response
    alt cache hit
        R-->>S: cached JSON
        S-->>G: 200 (X-Cache: HIT)
    else cache miss, or Redis down
        S->>P: SELECT ... WHERE origin = 'SEA'
        P-->>S: rows
        S->>R: store for 60 s (skipped if Redis is down)
        S-->>G: 200 (X-Cache: MISS)
    end
    G-->>C: 200 + JSON
    Note over S,R: Any POST, PUT, PATCH or DELETE bumps a version number,<br/>so older cached responses are never served again.
```

## 4. Asking the LLM for advice

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant L as LLM Service
    participant M as Groq
    participant P as PostgreSQL

    C->>G: POST /api/advice { user_id, topic, prompt }
    G->>L: forward
    alt "content" was sent
        L->>P: INSERT (source = user)
    else no GROQ_API_KEY
        L->>P: INSERT placeholder (source = stub)
    else normal case
        L->>M: chat completion (topic + prompt)
        alt model answers
            M-->>L: advice text
            L->>P: INSERT (source = llm)
        else model fails or times out
            L-->>G: 502 LLM_UNAVAILABLE
        end
    end
    L-->>G: 201 + saved record
    G-->>C: 201 + Location header
```

## 5. Data model (one database per service)

```mermaid
erDiagram
    FLIGHTS {
        int id PK
        text airline
        text flight_number
        text origin
        text destination
        timestamptz depart_at
        timestamptz arrive_at
        numeric price
        text currency
        int seats_available
        timestamptz created_at
    }
    HOTELS {
        int id PK
        text name
        text city
        text country
        text address
        int stars
        numeric price_per_night
        text currency
        numeric rating
        boolean available
        timestamptz created_at
    }
    CAR_RENTALS {
        int id PK
        text company
        text car_type
        text model
        text pickup_city
        int seats
        text transmission
        numeric price_per_day
        text currency
        boolean available
        timestamptz created_at
    }
    ACTIVITIES {
        int id PK
        text name
        text city
        text category
        text description
        numeric price
        text currency
        int duration_minutes
        numeric rating
        timestamptz created_at
    }
    ADVICE {
        int id PK
        text user_id
        int trip_id
        text topic
        text prompt
        text content
        text model
        text source
        timestamptz created_at
    }
```

The tables are deliberately separate databases with no foreign keys between them.
`ADVICE.user_id` and `ADVICE.trip_id` point at users and trips owned by the trip service,
so they are plain values, not enforced references.

`trip_db` (trip service) has its own foreign keys inside the one database:

```mermaid
erDiagram
    USERS ||--o{ TRIPS : owns
    TRIPS ||--|{ ITINERARIES : "one per date"
    ITINERARIES ||--o{ ITINERARY_ITEMS : "ordered by position"
    PLACES ||--o{ ITINERARY_ITEMS : "visited in"
    USERS {
        int id PK
        text name
        text email
        text password_hash
    }
    TRIPS {
        int id PK
        int owner_id FK
        text title
        text destination
        date start_date
        date end_date
    }
    ITINERARIES {
        int id PK
        int trip_id FK
        int day_number
        date date
    }
    ITINERARY_ITEMS {
        int id PK
        int itinerary_id FK
        int place_id FK
        int position
    }
    PLACES {
        int id PK
        text google_place_id
        text name
        text city
        text category
    }
```

## 6. Where the pieces live

```
Travel-Assistant/
├── docker-compose.yml          all containers, ports, database and cache wiring
├── docs/ARCHITECTURE.md        this file
└── backend/
    ├── gateway/                routing table in src/routes.js, URLs in src/config.js, openapi.yaml
    ├── user-service/           accounts, login, Google sign-in and profiles (REST, src/routes.js)
    ├── trip-service/           trips, trip flights, itineraries (hand-written; see its README.md)
    ├── flight-service/         each CRUD service has the same layout:
    ├── hotel-service/            server.js            start-up
    ├── car-rental-service/       src/resource.js      fields, filters, sample data (the only file that differs)
    ├── activity-service/         src/crud.js          generic CRUD routes and validation
    └── llm-service/              src/llm.js           (LLM service only) Groq call
                                  openapi.yaml, Dockerfile, package.json
```

API reference: `backend/gateway/openapi.yaml` and each service's Swagger UI at `http://localhost:<port>/docs` (with `docker-compose.dev.yml`).
