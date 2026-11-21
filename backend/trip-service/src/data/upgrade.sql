-- Runs on every start, after schema.sql. Each statement is safe to repeat, so a database created by
-- an older version gets the new columns without losing data.

-- Google Places: a place picked on the map is saved with its Google place ID, address and location.
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS lat     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng     DOUBLE PRECISION;
