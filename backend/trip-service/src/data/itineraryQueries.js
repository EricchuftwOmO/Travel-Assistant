const db = require('./db');

const DAY_COLUMNS = `i.id, i.trip_id AS "tripId", i.day_number AS "dayNumber", i.date`;

const ITEM_QUERY = `
  SELECT it.id, it.position,
    json_build_object(
      'id', p.id,
      'googlePlaceId', p.google_place_id,
      'name', p.name,
      'city', p.city,
      'category', p.category
    ) AS place
  FROM itinerary_items it
  JOIN places p ON p.id = it.place_id`;

// Gives the trip exactly dayCount days, dated from startDate. Days past the new
// end are deleted with their items, so callers check findDaysWithPlacesAfter first.
const syncDays = async (tripId, startDate, dayCount, client) => {
  await client.query('DELETE FROM itineraries WHERE trip_id = $1 AND day_number > $2', [
    tripId,
    dayCount,
  ]);
  await client.query(
    'UPDATE itineraries SET date = $2::date + (day_number - 1) WHERE trip_id = $1',
    [tripId, startDate]
  );
  await client.query(
    `INSERT INTO itineraries (trip_id, day_number, date)
     SELECT $1, n, $2::date + (n - 1) FROM generate_series(1, $3::int) AS n
     ON CONFLICT (trip_id, day_number) DO NOTHING`,
    [tripId, startDate, dayCount]
  );
};

// Locks the days after dayCount before checking them, so no place can be added
// to one of them between this check and the caller deleting them.
const findDaysWithPlacesAfter = async (tripId, dayCount, client) => {
  await client.query(
    'SELECT id FROM itineraries WHERE trip_id = $1 AND day_number > $2 FOR UPDATE',
    [tripId, dayCount]
  );
  const { rows } = await client.query(
    `SELECT i.day_number AS "dayNumber" FROM itineraries i
     WHERE i.trip_id = $1 AND i.day_number > $2
       AND EXISTS (SELECT 1 FROM itinerary_items it WHERE it.itinerary_id = i.id)
     ORDER BY i.day_number`,
    [tripId, dayCount]
  );
  return rows.map((row) => row.dayNumber);
};

const listDays = async (tripId) => {
  const { rows } = await db.query(
    `SELECT ${DAY_COLUMNS}, COUNT(it.id)::int AS "placeCount"
     FROM itineraries i
     LEFT JOIN itinerary_items it ON it.itinerary_id = i.id
     WHERE i.trip_id = $1
     GROUP BY i.id
     ORDER BY i.day_number`,
    [tripId]
  );
  return rows;
};

// Matches only when the trip belongs to ownerId, like every trip lookup.
const DAY_QUERY = `
  SELECT ${DAY_COLUMNS} FROM itineraries i
  JOIN trips t ON t.id = i.trip_id
  WHERE i.trip_id = $1 AND t.owner_id = $2 AND i.day_number = $3`;

const findDay = async (tripId, ownerId, dayNumber) => {
  const { rows } = await db.query(DAY_QUERY, [tripId, ownerId, dayNumber]);
  return rows[0] || null;
};

// Same as findDay, but holds a row lock until the transaction ends, so two
// requests that change the same day's positions run one after the other.
const lockDay = async (tripId, ownerId, dayNumber, client) => {
  const { rows } = await client.query(`${DAY_QUERY} FOR UPDATE OF i`, [
    tripId,
    ownerId,
    dayNumber,
  ]);
  return rows[0] || null;
};

const listItems = async (itineraryId, client = db) => {
  const { rows } = await client.query(
    `${ITEM_QUERY} WHERE it.itinerary_id = $1 ORDER BY it.position`,
    [itineraryId]
  );
  return rows;
};

const findItem = async (itineraryId, itemId, client = db) => {
  const { rows } = await client.query(
    `${ITEM_QUERY} WHERE it.itinerary_id = $1 AND it.id = $2`,
    [itineraryId, itemId]
  );
  return rows[0] || null;
};

const listItemIds = async (itineraryId, client) => {
  const { rows } = await client.query(
    'SELECT id FROM itinerary_items WHERE itinerary_id = $1 ORDER BY position',
    [itineraryId]
  );
  return rows.map((row) => row.id);
};

// Moves the items at position and after down one place, then fills the gap.
const insertItem = async (itineraryId, placeId, position, client) => {
  await client.query(
    'UPDATE itinerary_items SET position = position + 1 WHERE itinerary_id = $1 AND position >= $2',
    [itineraryId, position]
  );
  const { rows } = await client.query(
    `INSERT INTO itinerary_items (itinerary_id, place_id, position)
     VALUES ($1, $2, $3) RETURNING id`,
    [itineraryId, placeId, position]
  );
  return rows[0].id;
};

// itemIds lists every item of the day in its new order; position 1 comes first.
const reorderItems = async (itineraryId, itemIds, client) => {
  await client.query(
    `UPDATE itinerary_items it SET position = v.position
     FROM unnest($2::int[]) WITH ORDINALITY AS v(id, position)
     WHERE it.id = v.id AND it.itinerary_id = $1`,
    [itineraryId, itemIds]
  );
};

// Removes one item and moves the items after it up, so positions stay 1, 2, 3...
const deleteItem = async (itineraryId, itemId, client) => {
  const { rows } = await client.query(
    'DELETE FROM itinerary_items WHERE itinerary_id = $1 AND id = $2 RETURNING position',
    [itineraryId, itemId]
  );
  if (!rows.length) return false;
  await client.query(
    'UPDATE itinerary_items SET position = position - 1 WHERE itinerary_id = $1 AND position > $2',
    [itineraryId, rows[0].position]
  );
  return true;
};

const clearItems = async (itineraryId, client) => {
  await client.query('DELETE FROM itinerary_items WHERE itinerary_id = $1', [itineraryId]);
};

module.exports = {
  syncDays,
  findDaysWithPlacesAfter,
  listDays,
  findDay,
  lockDay,
  listItems,
  findItem,
  listItemIds,
  insertItem,
  reorderItems,
  deleteItem,
  clearItems,
};
