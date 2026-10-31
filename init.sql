CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date DATE,
  end_date DATE
);

INSERT INTO trips (user_id, title, start_date, end_date) VALUES
  ('u1', 'Tokyo Trip', '2026-12-01', '2026-12-05'),
  ('u1', 'Seattle Weekend', '2027-01-10', '2027-01-12'),
  ('u2', 'Taipei Visit', '2027-02-01', '2027-02-07');
