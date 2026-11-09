# Travel Assistant: architecture (current state)

Diagrams are [Mermaid](https://mermaid.js.org/), so they render on GitHub and in most Markdown
viewers. Solid boxes exist today. **Dashed boxes are in the plan but not built yet**
(Budget).

## 1. Services

```mermaid
flowchart TB
    client["CLIENT<br/>(React app, later)"]
    gateway["API GATEWAY :8080<br/>routing · CORS · X-Request-Id · timeouts · /api/health"]

    client --> gateway

    subgraph planned["Planned, not built yet"]
        direction LR
        budget["BUDGET SERVICE :3003"]:::planned
    end

    trip["TRIP SERVICE :3001<br/>/api/auth · /api/users<br/>/api/trips (+ itineraries) · /api/places<br/>(JWT auth)"]

    gateway -->|"/api/auth, /api/users, /api/trips, /api/places"| trip
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

    %% Planned: the LLM service is the AI component. It calls the search services directly
    %% (not through the gateway) to gather options for a recommendation summary.
    %% Planned: live flight and hotel results come from SerpApi (Google Flights / Google Hotels).
    serpapi["SERPAPI<br/>(external, planned)"]:::planned
    flight -.->|"planned: live results"| serpapi
    hotel -.->|"planned: live results"| serpapi

    llm -.->|"planned: gathers options"| flight
    llm -.-> hotel
    llm -.-> car
    llm -.-> activity

    classDef planned stroke-dasharray: 5 5,fill:#f4f4f4,color:#666
```

Dotted arrows to Redis mean the cache is optional: if Redis is down, the services read
from PostgreSQL instead.

**The AI component is the LLM service.** Today it saves advice and, when asked, has Groq write
it. In Phase III it will also build a recommendation summary: it calls the Flight, Hotel, Car
Rental and Activity services directly (the dotted arrows from `llm`), lets the model choose
among the results, adds up the cost in code, and saves the result in `llm_db`. There is no
separate agent calling the gateway.

## 2. Containers and ports

| Container | Image / folder | Port | Published | Depends on |
|---|---|---|---|---|
| `gateway` | `backend/gateway` | 8080 | `8080` (all clients) | none (answers 502 if a service is down) |
| `trip-service` | `backend/trip-service` | 3001 | `127.0.0.1:3001` | postgres (healthy) |
| `flight-service` | `backend/flight-service` | 3004 | `127.0.0.1:3004` | postgres (healthy), redis |
| `hotel-service` | `backend/hotel-service` | 3005 | `127.0.0.1:3005` | postgres (healthy), redis |
| `car-rental-service` | `backend/car-rental-service` | 3006 | `127.0.0.1:3006` | postgres (healthy), redis |
| `activity-service` | `backend/activity-service` | 3007 | `127.0.0.1:3007` | postgres (healthy), redis |
| `llm-service` | `backend/llm-service` | 3008 | `127.0.0.1:3008` | postgres (healthy) |
| `postgres` | `postgres:16` | 5432 | no | none |
| `redis` | `redis:7-alpine` | 6379 | no | none |

The `127.0.0.1` ports exist only so each service's Swagger UI (`/docs`) can be opened
during development.

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
    ├── trip-service/           accounts, trips, itineraries (hand-written; see its README.md)
    ├── flight-service/         each CRUD service has the same layout:
    ├── hotel-service/            server.js            start-up
    ├── car-rental-service/       src/resource.js      fields, filters, sample data (the only file that differs)
    ├── activity-service/         src/crud.js          generic CRUD routes and validation
    └── llm-service/              src/llm.js           (LLM service only) Groq call
                                  openapi.yaml, Dockerfile, package.json
```

API reference: `backend/gateway/openapi.yaml` (everything) and each service's own
`openapi.yaml` / Swagger UI at `http://localhost:<port>/docs`.
