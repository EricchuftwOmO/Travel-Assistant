const db = require('./db');

const FLIGHT_COLUMNS = `id, trip_id AS "tripId", flight_id AS "flightId", airline,
  flight_number AS "flightNumber", origin, destination, depart_at AS "departAt",
  arrive_at AS "arriveAt", price::float AS price, currency, created_at AS "createdAt"`;

// flight is a record from the flight service (snake_case fields); its details are copied.
const addFlight = async (tripId, flight, client = db) => {
  const { rows } = await client.query(
    `INSERT INTO trip_flights
       (trip_id, flight_id, airline, flight_number, origin, destination, depart_at, arrive_at, price, currency)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${FLIGHT_COLUMNS}`,
    [
      tripId,
      flight.id,
      flight.airline,
      flight.flight_number,
      flight.origin,
      flight.destination,
      flight.depart_at,
      flight.arrive_at,
      flight.price,
      flight.currency || 'USD',
    ]
  );
  return rows[0];
};

const listFlights = async (tripId) => {
  const { rows } = await db.query(
    `SELECT ${FLIGHT_COLUMNS} FROM trip_flights WHERE trip_id = $1 ORDER BY depart_at, id`,
    [tripId]
  );
  return rows;
};

const deleteFlight = async (tripId, id) => {
  const { rowCount } = await db.query('DELETE FROM trip_flights WHERE trip_id = $1 AND id = $2', [
    tripId,
    id,
  ]);
  return rowCount > 0;
};

module.exports = { addFlight, listFlights, deleteFlight };
