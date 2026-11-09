#!/bin/sh
# Loads the six exported databases into the PostgreSQL container started by docker compose.
# Not needed for normal use: each service creates its table and loads its sample rows on first start.
# Use this to reload the sample data by hand:   docker compose up -d postgres && sh data/load-all.sh
set -e
cd "$(dirname "$0")/.."
for db in trip_db flight_db hotel_db car_rental_db activity_db llm_db; do
  docker compose exec -T postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 \
    || docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE $db"
  docker compose exec -T postgres psql -U postgres -d "$db" -v ON_ERROR_STOP=1 < "data/$db.sql" > /dev/null
  echo "loaded $db"
done
