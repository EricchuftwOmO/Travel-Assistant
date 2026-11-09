const ApiError = require('../helpers/ApiError');
const {
  validateTripId,
  validateDayNumber,
  validateItemId,
  validateNewItem,
  validateItemOrder,
} = require('../helpers/validators');
const { withTransaction } = require('../data/db');
const trips = require('../data/tripQueries');
const itineraries = require('../data/itineraryQueries');
const places = require('../data/placeQueries');

const itemNotFound = () => new ApiError(404, 'Itinerary item not found');

const invalidRequest = (detail) => new ApiError(400, 'Request validation failed', [detail]);

// A day lookup fails either because the trip is not the user's, or because
// the trip has no such day. The message says which.
const missingDay = async (tripId, userId) => {
  const trip = await trips.findTrip(tripId, userId);
  return new ApiError(404, trip ? 'Day not found' : 'Trip not found');
};

const findDayOrFail = async (req) => {
  const tripId = validateTripId(req);
  const day = await itineraries.findDay(tripId, req.user.id, validateDayNumber(req));
  if (!day) throw await missingDay(tripId, req.user.id);
  return day;
};

// Runs work(day, client) in a transaction that holds a lock on the day, so
// changes to the same day's positions never interleave.
const withLockedDay = (req, work) => {
  const tripId = validateTripId(req);
  const dayNumber = validateDayNumber(req);
  return withTransaction(async (client) => {
    const day = await itineraries.lockDay(tripId, req.user.id, dayNumber, client);
    if (!day) throw await missingDay(tripId, req.user.id);
    return work(day, client);
  });
};

const listDays = async (req, res) => {
  const tripId = validateTripId(req);
  if (!(await trips.findTrip(tripId, req.user.id))) throw new ApiError(404, 'Trip not found');

  const days = await itineraries.listDays(tripId);
  res.status(200).set('X-Total-Count', String(days.length)).json(days);
};

const getDay = async (req, res) => {
  const day = await findDayOrFail(req);
  res.status(200).json({ ...day, items: await itineraries.listItems(day.id) });
};

const getItem = async (req, res) => {
  const itemId = validateItemId(req);
  const day = await findDayOrFail(req);
  const item = await itineraries.findItem(day.id, itemId);
  if (!item) throw itemNotFound();
  res.status(200).json(item);
};

const addItem = async (req, res) => {
  const { placeId, position } = validateNewItem(req);

  const { day, item } = await withLockedDay(req, async (lockedDay, client) => {
    if (!(await places.findPlace(placeId, client))) {
      throw invalidRequest('placeId does not match any place');
    }

    const count = (await itineraries.listItemIds(lockedDay.id, client)).length;
    const target = position ?? count + 1;
    if (target > count + 1) {
      throw invalidRequest(`position must be between 1 and ${count + 1}`);
    }

    const itemId = await itineraries.insertItem(lockedDay.id, placeId, target, client);
    return { day: lockedDay, item: await itineraries.findItem(lockedDay.id, itemId, client) };
  });

  res
    .status(201)
    .location(`/api/trips/${day.tripId}/itineraries/${day.dayNumber}/items/${item.id}`)
    .json(item);
};

const reorderItems = async (req, res) => {
  const itemIds = validateItemOrder(req);

  const result = await withLockedDay(req, async (day, client) => {
    const currentIds = await itineraries.listItemIds(day.id, client);
    // itemIds has no duplicates, so equal length plus full overlap means the same set.
    const sameItems =
      itemIds.length === currentIds.length && itemIds.every((id) => currentIds.includes(id));
    if (!sameItems) throw invalidRequest('itemIds must list every item of this day exactly once');

    await itineraries.reorderItems(day.id, itemIds, client);
    return { ...day, items: await itineraries.listItems(day.id, client) };
  });

  res.status(200).json(result);
};

const removeItem = async (req, res) => {
  const itemId = validateItemId(req);

  await withLockedDay(req, async (day, client) => {
    if (!(await itineraries.deleteItem(day.id, itemId, client))) throw itemNotFound();
  });

  res.status(204).end();
};

// Empties the day. The day itself stays, because the trip's dates define its days.
const clearItems = async (req, res) => {
  await withLockedDay(req, (day, client) => itineraries.clearItems(day.id, client));
  res.status(204).end();
};

module.exports = {
  listDays,
  getDay,
  getItem,
  addItem,
  reorderItems,
  removeItem,
  clearItems,
};
