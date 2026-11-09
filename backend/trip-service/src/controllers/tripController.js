const ApiError = require('../helpers/ApiError');
const { countDays } = require('../helpers/dates');
const { validateTrip, validateTripId, validateTripFilters } = require('../helpers/validators');
const { withTransaction } = require('../data/db');
const trips = require('../data/tripQueries');
const itineraries = require('../data/itineraryQueries');

// Another user's trip gets the same 404 as a missing one, so its existence stays hidden.
const tripNotFound = () => new ApiError(404, 'Trip not found');

const createTrip = async (req, res) => {
  const fields = validateTrip(req);
  const dayCount = countDays(fields.startDate, fields.endDate);

  // The trip and one itinerary day per date are created together, or not at all.
  const trip = await withTransaction(async (client) => {
    const created = await trips.createTrip(req.user.id, fields, client);
    await itineraries.syncDays(created.id, fields.startDate, dayCount, client);
    return created;
  });

  res.status(201).location(`/api/trips/${trip.id}`).json(trip);
};

const listTrips = async (req, res) => {
  const results = await trips.listTrips(req.user.id, validateTripFilters(req));
  res.status(200).set('X-Total-Count', String(results.length)).json(results);
};

const getTrip = async (req, res) => {
  const trip = await trips.findTrip(validateTripId(req), req.user.id);
  if (!trip) throw tripNotFound();
  res.status(200).json(trip);
};

const updateTrip = async (req, res) => {
  const id = validateTripId(req);
  const fields = validateTrip(req);
  const dayCount = countDays(fields.startDate, fields.endDate);

  const trip = await withTransaction(async (client) => {
    const updated = await trips.updateTrip(id, req.user.id, fields, client);
    if (!updated) throw tripNotFound();

    // Shortening a trip must not silently throw away places that were planned.
    const blockedDays = await itineraries.findDaysWithPlacesAfter(id, dayCount, client);
    if (blockedDays.length) {
      throw new ApiError(
        409,
        'The new dates would remove days that still have places',
        blockedDays.map((day) => `Day ${day} has places; remove them first`)
      );
    }

    await itineraries.syncDays(id, fields.startDate, dayCount, client);
    return updated;
  });

  res.status(200).json(trip);
};

const deleteTrip = async (req, res) => {
  const deleted = await trips.deleteTrip(validateTripId(req), req.user.id);
  if (!deleted) throw tripNotFound();
  res.status(204).end();
};

module.exports = { createTrip, listTrips, getTrip, updateTrip, deleteTrip };
