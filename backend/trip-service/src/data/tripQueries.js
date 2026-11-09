const db = require('./db');

const TRIP_COLUMNS = `id, owner_id AS "ownerId", title, destination,
  start_date AS "startDate", end_date AS "endDate", created_at AS "createdAt"`;

// Treat % and _ in the search text as literal characters, not ILIKE wildcards.
const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

const createTrip = async (ownerId, { title, destination, startDate, endDate }, client = db) => {
  const { rows } = await client.query(
    `INSERT INTO trips (owner_id, title, destination, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${TRIP_COLUMNS}`,
    [ownerId, title, destination, startDate, endDate]
  );
  return rows[0];
};

const listTrips = async (ownerId, { search, status }) => {
  const conditions = ['owner_id = $1'];
  const params = [ownerId];

  if (search) {
    params.push(`%${escapeLike(search)}%`);
    conditions.push(`title ILIKE $${params.length}`);
  }
  // A trip in progress counts as upcoming until its last day has passed.
  if (status === 'upcoming') conditions.push('end_date >= CURRENT_DATE');
  if (status === 'past') conditions.push('end_date < CURRENT_DATE');

  const { rows } = await db.query(
    `SELECT ${TRIP_COLUMNS} FROM trips
     WHERE ${conditions.join(' AND ')}
     ORDER BY start_date, id`,
    params
  );
  return rows;
};

// Every lookup below is scoped by owner_id, so another user's trip is never matched.
const findTrip = async (id, ownerId) => {
  const { rows } = await db.query(
    `SELECT ${TRIP_COLUMNS} FROM trips WHERE id = $1 AND owner_id = $2`,
    [id, ownerId]
  );
  return rows[0] || null;
};

const updateTrip = async (
  id,
  ownerId,
  { title, destination, startDate, endDate },
  client = db
) => {
  const { rows } = await client.query(
    `UPDATE trips
     SET title = $3, destination = $4, start_date = $5, end_date = $6
     WHERE id = $1 AND owner_id = $2
     RETURNING ${TRIP_COLUMNS}`,
    [id, ownerId, title, destination, startDate, endDate]
  );
  return rows[0] || null;
};

const deleteTrip = async (id, ownerId) => {
  const { rowCount } = await db.query(
    'DELETE FROM trips WHERE id = $1 AND owner_id = $2',
    [id, ownerId]
  );
  return rowCount > 0;
};

module.exports = { createTrip, listTrips, findTrip, updateTrip, deleteTrip };
