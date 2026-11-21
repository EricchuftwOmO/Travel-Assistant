const db = require('./db');

const PLACE_COLUMNS = `id, google_place_id AS "googlePlaceId", name, city, category, address, lat, lng`;

// city and category match whole values, ignoring case.
const listPlaces = async ({ city, category }) => {
  const conditions = [];
  const params = [];

  if (city) {
    params.push(city);
    conditions.push(`LOWER(city) = LOWER($${params.length})`);
  }
  if (category) {
    params.push(category);
    conditions.push(`LOWER(category) = LOWER($${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT ${PLACE_COLUMNS} FROM places ${where} ORDER BY city, name`,
    params
  );
  return rows;
};

const findPlace = async (id, client = db) => {
  const { rows } = await client.query(`SELECT ${PLACE_COLUMNS} FROM places WHERE id = $1`, [id]);
  return rows[0] || null;
};

// Saves a place picked from Google (or refreshes its details) and returns it.
// google_place_id is unique, so the same Google place is stored only once.
const upsertGooglePlace = async ({ googlePlaceId, name, city, category, address, lat, lng }, client = db) => {
  const { rows } = await client.query(
    `INSERT INTO places (google_place_id, name, city, category, address, lat, lng)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (google_place_id) DO UPDATE SET
       name = EXCLUDED.name, city = EXCLUDED.city, category = EXCLUDED.category,
       address = EXCLUDED.address, lat = EXCLUDED.lat, lng = EXCLUDED.lng
     RETURNING ${PLACE_COLUMNS}`,
    [googlePlaceId, name, city, category, address, lat, lng]
  );
  return rows[0];
};

module.exports = { listPlaces, findPlace, upsertGooglePlace };
