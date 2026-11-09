const db = require('./db');

const PLACE_COLUMNS = `id, google_place_id AS "googlePlaceId", name, city, category`;

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

module.exports = { listPlaces, findPlace };
