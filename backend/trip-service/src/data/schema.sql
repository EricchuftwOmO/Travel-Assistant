CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE trips (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
