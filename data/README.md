# Sample data

Each service owns one PostgreSQL database. These files are `pg_dump` exports of the sample data that each
service also loads by itself on first start.

| File | Service | Contents |
|---|---|---|
| `trip_db.sql` | Trip | users (`alice@example.com`, password `Password123!`), trips, places, itineraries |
| `flight_db.sql` | Flight | 6 flights, prices $119 to $912 |
| `hotel_db.sql` | Hotel | 6 hotels in Tokyo, Seattle, Taipei; one unavailable |
| `car_rental_db.sql` | Car Rental | 6 cars; one unavailable |
| `activity_db.sql` | Activity | 8 activities; two free |
| `llm_db.sql` | LLM | 2 advice records |

Useful edge cases: `city=Atlantis` returns `count: 0`, `carType=boat` returns 400, and a destination with no
data makes the recommendation endpoint return 404.

## Load by hand

Normally not needed. To reload the exports into the running database:

```sh
docker compose up -d postgres
sh data/load-all.sh
```

Reset to the sample data: `docker compose down -v`, then `docker compose up --build`.
