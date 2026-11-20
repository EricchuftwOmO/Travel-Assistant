const ApiError = require('../helpers/ApiError');
const { validatePlaceFilters, validateNearby, validateLocate } = require('../helpers/validators');
const google = require('../helpers/googlePlaces');
const places = require('../data/placeQueries');

const listPlaces = async (req, res) => {
  const results = await places.listPlaces(validatePlaceFilters(req));
  res.status(200).set('X-Total-Count', String(results.length)).json(results);
};

// Places from Google around a point (the map's visible area).
const nearbyPlaces = async (req, res) => {
  const results = await google.searchNearby(validateNearby(req));
  res.status(200).set('X-Total-Count', String(results.length)).json(results);
};

// The location of a destination name, to center the map on it.
const locatePlace = async (req, res) => {
  const { q, language } = validateLocate(req);
  const location = await google.locate(q, language);
  if (!location) throw new ApiError(404, `No location found for "${q}"`);
  res.status(200).json(location);
};

// Tells the app whether Google Places can be used, so it can fall back to the sample catalog.
const placesConfig = (req, res) => {
  res.status(200).json({ googlePlaces: google.isConfigured() });
};

module.exports = { listPlaces, nearbyPlaces, locatePlace, placesConfig };
