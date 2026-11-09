-- Simulated demo data. Every seeded user signs in with the password: Password123!
INSERT INTO users (name, email, password_hash) VALUES
  ('Alice Chen',  'alice@example.com', '$2b$10$oeX2uQ5Jre4KLF6wl9hEFeIl9Bq21T93ujHQcqYACRmnHLJz7ZsMe'),
  ('Bob Tanaka',  'bob@example.com',   '$2b$10$oeX2uQ5Jre4KLF6wl9hEFeIl9Bq21T93ujHQcqYACRmnHLJz7ZsMe'),
  ('Carol Lopez', 'carol@example.com', '$2b$10$oeX2uQ5Jre4KLF6wl9hEFeIl9Bq21T93ujHQcqYACRmnHLJz7ZsMe'),
  ('David Kim',   'david@example.com', '$2b$10$oeX2uQ5Jre4KLF6wl9hEFeIl9Bq21T93ujHQcqYACRmnHLJz7ZsMe'),
  ('Emma Wilson', 'emma@example.com',  '$2b$10$oeX2uQ5Jre4KLF6wl9hEFeIl9Bq21T93ujHQcqYACRmnHLJz7ZsMe');

INSERT INTO trips (owner_id, title, destination, start_date, end_date) VALUES
  (1, 'Japan Trip',           'Tokyo',       '2027-01-28', '2027-02-03'),
  (1, 'California Road Trip', 'California',  '2027-03-10', '2027-03-15'),
  (1, 'Taiwan Trip',          'Taiwan',      '2027-06-01', '2027-06-10'),
  (1, 'Vancouver Weekend',    'Vancouver',   '2026-05-15', '2026-05-17'),
  (1, 'Japan Spring Getaway', 'Osaka',       '2026-04-02', '2026-04-09'),
  (2, 'Korea Food Tour',      'Seoul',       '2027-02-12', '2027-02-18'),
  (2, 'Hawaii Vacation',      'Honolulu',    '2026-07-20', '2026-07-27'),
  (2, 'New York City Break',  'New York',    '2027-04-05', '2027-04-09'),
  (3, 'Europe Rail Trip',     'Paris',       '2027-05-14', '2027-05-28'),
  (3, 'Mexico Family Visit',  'Mexico City', '2026-03-08', '2026-03-16'),
  (3, 'Portland Coffee Trip', 'Portland',    '2026-09-11', '2026-09-13'),
  (4, 'Iceland Ring Road',    'Reykjavik',   '2027-08-02', '2027-08-12'),
  (4, 'Banff Ski Trip',       'Banff',       '2026-02-06', '2026-02-11'),
  (5, 'Thailand Island Hop',  'Phuket',      '2027-01-05', '2027-01-15'),
  (5, 'Yellowstone Camping',  'Wyoming',     '2026-08-14', '2026-08-20');

INSERT INTO places (name, city, category) VALUES
  ('Senso-ji Temple',        'Tokyo',         'attraction'),
  ('Tokyo Skytree',          'Tokyo',         'attraction'),
  ('Meiji Jingu',            'Tokyo',         'attraction'),
  ('Shibuya Crossing',       'Tokyo',         'attraction'),
  ('Tsukiji Outer Market',   'Tokyo',         'food'),
  ('teamLab Planets',        'Tokyo',         'museum'),
  ('Osaka Castle',           'Osaka',         'attraction'),
  ('Dotonbori',              'Osaka',         'food'),
  ('Kuromon Market',         'Osaka',         'food'),
  ('Taipei 101',             'Taipei',        'attraction'),
  ('National Palace Museum', 'Taipei',        'museum'),
  ('Shilin Night Market',    'Taipei',        'food'),
  ('Jiufen Old Street',      'New Taipei',    'shopping'),
  ('Golden Gate Bridge',     'San Francisco', 'attraction'),
  ('Griffith Observatory',   'Los Angeles',   'attraction'),
  ('Yosemite Valley',        'Yosemite',      'nature'),
  ('Stanley Park',           'Vancouver',     'nature'),
  ('Granville Island',       'Vancouver',     'shopping'),
  ('Gyeongbokgung Palace',   'Seoul',         'attraction'),
  ('Myeongdong',             'Seoul',         'shopping'),
  ('Eiffel Tower',           'Paris',         'attraction'),
  ('Louvre Museum',          'Paris',         'museum');

-- One itinerary day for every date of every trip, as the API creates them.
INSERT INTO itineraries (trip_id, day_number, date)
SELECT t.id, d.n, t.start_date + (d.n - 1)
FROM trips t
CROSS JOIN LATERAL generate_series(1, t.end_date - t.start_date + 1) AS d(n);

INSERT INTO itinerary_items (itinerary_id, place_id, position)
SELECT i.id, p.id, v.position
FROM (VALUES
  (1, 1, 'Senso-ji Temple',        1),
  (1, 1, 'Tokyo Skytree',          2),
  (1, 2, 'Meiji Jingu',            1),
  (1, 2, 'Shibuya Crossing',       2),
  (1, 2, 'teamLab Planets',        3),
  (1, 3, 'Tsukiji Outer Market',   1),
  (3, 1, 'Taipei 101',             1),
  (3, 1, 'Shilin Night Market',    2),
  (3, 2, 'National Palace Museum', 1),
  (3, 2, 'Jiufen Old Street',      2),
  (5, 1, 'Osaka Castle',           1),
  (5, 1, 'Dotonbori',              2),
  (6, 1, 'Gyeongbokgung Palace',   1),
  (6, 1, 'Myeongdong',             2)
) AS v (trip_id, day_number, place_name, position)
JOIN itineraries i ON i.trip_id = v.trip_id AND i.day_number = v.day_number
JOIN places p ON p.name = v.place_name;
