const ApiError = require('../helpers/ApiError');
const { validateTripId, validateTripFlightId, validateFlightId } = require('../helpers/validators');
const { fetchFlight } = require('../helpers/flightClient');
const trips = require('../data/tripQueries');
const flights = require('../data/flightQueries');

const UNIQUE_VIOLATION = '23505';

const findTripOrFail = async (req) => {
  const trip = await trips.findTrip(validateTripId(req), req.user.id);
  if (!trip) throw new ApiError(404, 'Trip not found');
  return trip;
};

const listFlights = async (req, res) => {
  const trip = await findTripOrFail(req);
  const results = await flights.listFlights(trip.id);
  res.status(200).set('X-Total-Count', String(results.length)).json(results);
};

// Attaches a flight from the flight service; its details are copied onto the trip.
const addFlight = async (req, res) => {
  const flightId = validateFlightId(req);
  const trip = await findTripOrFail(req);
  const flight = await fetchFlight(flightId);

  const added = await flights.addFlight(trip.id, flight).catch((err) => {
    if (err.code === UNIQUE_VIOLATION) throw new ApiError(409, 'This flight is already on the trip');
    throw err;
  });

  res.status(201).location(`/api/trips/${trip.id}/flights/${added.id}`).json(added);
};

const removeFlight = async (req, res) => {
  const tripFlightId = validateTripFlightId(req);
  const trip = await findTripOrFail(req);
  if (!(await flights.deleteFlight(trip.id, tripFlightId))) {
    throw new ApiError(404, 'Flight not found on this trip');
  }
  res.status(204).end();
};

module.exports = { listFlights, addFlight, removeFlight };
