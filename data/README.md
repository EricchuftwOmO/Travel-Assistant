# Sample data and database scripts

Each service owns one PostgreSQL database. The files here are exports (`pg_dump`, schema plus rows) of the
**sample data** that every service also loads by itself the first time it starts.

| File | Database | Service | Rows | What it exercises |
|---|---|---|---|---|
| `trip_db.sql` | `trip_db` | Trip Service | users, trips, places, itineraries and items | seeded accounts (`alice@example.com`, password `Password123!`), trips with one itinerary day per date, a places catalog by city and category |
| `flight_db.sql` | `flight_db` | Flight Service | 6 | SEA to HND/ICN/TPE and LAX/SFO to SEA; prices $119 to $912; two flights on one route (sorting by price) |
| `hotel_db.sql` | `hotel_db` | Hotel Service | 6 | Tokyo, Seattle, Taipei; 2 to 5 stars; **one unavailable hotel** (`available=false` filter) |
| `car_rental_db.sql` | `car_rental_db` | Car Rental Service | 6 | economy to luxury; **one unavailable car** |
| `activity_db.sql` | `activity_db` | Activity Service | 8 | food, museum, outdoors, sightseeing; **two free activities** (price 0) |
| `llm_db.sql` | `llm_db` | LLM Service | 2 | advice written by a person (`source = user`) |

Edge cases for testing: filters that match nothing (`city=Atlantis` returns `count: 0`), an unknown enum value
(`carType=boat` returns 400), a destination with no data (the recommendation endpoint returns 404).

## Loading

Normal use needs nothing: `docker compose up --build` creates every database and loads these rows.

To load the exports by hand (for example into an empty database):

```sh
docker compose up -d postgres
sh data/load-all.sh                      # all six
# or one database:
docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE flight_db"
docker compose exec -T postgres psql -U postgres -d flight_db < data/flight_db.sql
```

Reset to the sample data: `docker compose down -v` (deletes the volume), then `docker compose up --build`.

## Check the data

```sh
curl "http://localhost:8080/api/flights?origin=SEA&sort=price"
docker compose exec postgres psql -U postgres -d flight_db -c "SELECT id, airline, origin, destination, price FROM flights"
```
