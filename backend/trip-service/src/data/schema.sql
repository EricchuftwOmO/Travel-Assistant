-- owner_id is a user id from the user service (user_db). It is not a foreign key,
-- because the users table lives in another service's database.
CREATE TABLE trips (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER NOT NULL,
  title       TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trips_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX trips_owner_id_idx ON trips (owner_id);

-- Places that can be added to an itinerary. google_place_id is reserved for a
-- later Google Places integration and stays empty for now.
CREATE TABLE places (
  id              SERIAL PRIMARY KEY,
  google_place_id TEXT UNIQUE,
  name            TEXT NOT NULL,
  city            TEXT NOT NULL,
  category        TEXT NOT NULL
);

-- One row per travel day. The API keeps these rows in step with the trip's dates.
CREATE TABLE itineraries (
  id         SERIAL PRIMARY KEY,
  trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number >= 1),
  date       DATE NOT NULL,
  CONSTRAINT itineraries_trip_day_key UNIQUE (trip_id, day_number)
);

-- The ordered places of one day. Inserting or reordering shifts several
-- positions at once, so uniqueness is checked at commit instead of per row.
CREATE TABLE itinerary_items (
  id           SERIAL PRIMARY KEY,
  itinerary_id INTEGER NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  place_id     INTEGER NOT NULL REFERENCES places(id),
  position     INTEGER NOT NULL CHECK (position >= 1),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT itinerary_items_position_key UNIQUE (itinerary_id, position)
    DEFERRABLE INITIALLY DEFERRED
);

-- Flights attached to a trip. The flight's details are copied from the flight
-- service when it is attached, so the trip keeps them even if that flight changes
-- or is removed there. flight_id is the flight service's id, not a foreign key.
CREATE TABLE trip_flights (
  id            SERIAL PRIMARY KEY,
  trip_id       INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  flight_id     INTEGER,
  airline       TEXT NOT NULL,
  flight_number TEXT NOT NULL,
  origin        TEXT NOT NULL,
  destination   TEXT NOT NULL,
  depart_at     TIMESTAMPTZ NOT NULL,
  arrive_at     TIMESTAMPTZ NOT NULL,
  price         NUMERIC(10, 2) NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'USD',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trip_flights_trip_flight_key UNIQUE (trip_id, flight_id)
);

CREATE INDEX trip_flights_trip_id_idx ON trip_flights (trip_id);
