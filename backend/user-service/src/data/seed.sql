-- Simulated demo users. Every one signs in with the password: Password123!
-- The ids (1-5) match the owner_id values in the trip service's sample trips.
INSERT INTO users (first_name, last_name, email, password_hash, gender, date_of_birth, phone, country, language, timezone) VALUES
  ('Alice', 'Chen',   'alice@example.com', '$2b$10$oeX2uQ5Jre4KLF6wl9hEFeIl9Bq21T93ujHQcqYACRmnHLJz7ZsMe', 'FEMALE', '1998-04-12', '+1 (206) 555-0142', 'United States', 'en',    'America/Los_Angeles'),
  ('Bob',   'Tanaka', 'bob@example.com',   '$2b$10$oeX2uQ5Jre4KLF6wl9hEFeIl9Bq21T93ujHQcqYACRmnHLJz7ZsMe', 'MALE',   '1995-09-30', '+81 3-5555-0199',   'Japan',         'ja',    'Asia/Tokyo'),
  ('Carol', 'Lopez',  'carol@example.com', '$2b$10$oeX2uQ5Jre4KLF6wl9hEFeIl9Bq21T93ujHQcqYACRmnHLJz7ZsMe', NULL,     NULL,         NULL,                'Mexico',        'es',    'America/Mexico_City'),
  ('David', 'Kim',    'david@example.com', '$2b$10$oeX2uQ5Jre4KLF6wl9hEFeIl9Bq21T93ujHQcqYACRmnHLJz7ZsMe', NULL,     NULL,         NULL,                'Canada',        'en',    'America/Vancouver'),
  ('Emma',  'Wilson', 'emma@example.com',  '$2b$10$oeX2uQ5Jre4KLF6wl9hEFeIl9Bq21T93ujHQcqYACRmnHLJz7ZsMe', NULL,     NULL,         NULL,                'United States', 'en',    'America/New_York');

INSERT INTO travel_preferences (user_id, budget_level, travel_styles) VALUES
  (1, 'MODERATE', '{FOOD,CULTURE}'),
  (2, 'LUXURY',   '{RELAXATION}');
