const ApiError = require('./ApiError');
const { countDays } = require('./dates');

const MAX_ID = 2147483647; // largest value of a PostgreSQL INTEGER
const MAX_TRIP_DAYS = 90; // every day becomes an itinerary row, so length is capped
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TRIP_STATUSES = ['upcoming', 'past'];
const PLACE_CATEGORIES = ['attraction', 'food', 'museum', 'nature', 'shopping'];
const GOOGLE_PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

const fail = (details) => {
  throw new ApiError(400, 'Request validation failed', details);
};

const bodyOf = (req) => {
  const { body } = req;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    fail(['Request body must be a JSON object']);
  }
  return body;
};

const isId = (value) => Number.isInteger(value) && value >= 1 && value <= MAX_ID;

// Trims a required string, or records a problem in errors.
const readText = (body, field, maxLength, errors) => {
  const value = body[field];
  if (typeof value !== 'string' || value.includes('\0') || value.trim() === '') {
    errors.push(`${field} is required and must be a non-empty string`);
    return undefined;
  }
  const text = value.trim();
  if (text.length > maxLength) errors.push(`${field} must be at most ${maxLength} characters`);
  return text;
};

// Reads an optional query-string filter. A repeated parameter arrives as an
// array and is rejected, and a blank value counts as no filter.
const readQueryText = (query, field, errors) => {
  const value = query[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.includes('\0') || value.length > 120) {
    errors.push(`${field} must be a single string of at most 120 characters`);
    return undefined;
  }
  return value.trim() || undefined;
};

const readIdParam = (req, name) => {
  const value = req.params[name];
  const id = Number(value);
  if (!/^\d+$/.test(value) || !isId(id)) fail([`${name} must be a positive integer`]);
  return id;
};

const isRealDate = (value) => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  // Rejects values such as 2027-02-30, which Date would roll over to March.
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const validateTrip = (req) => {
  const body = bodyOf(req);
  const errors = [];
  const title = readText(body, 'title', 120, errors);
  const destination = readText(body, 'destination', 120, errors);
  const { startDate, endDate } = body;
  const startValid = isRealDate(startDate);
  const endValid = isRealDate(endDate);
  if (!startValid) errors.push('startDate must be a valid date in YYYY-MM-DD format');
  if (!endValid) errors.push('endDate must be a valid date in YYYY-MM-DD format');
  if (startValid && endValid) {
    if (endDate < startDate) {
      errors.push('endDate must be on or after startDate');
    } else if (countDays(startDate, endDate) > MAX_TRIP_DAYS) {
      errors.push(`a trip can last at most ${MAX_TRIP_DAYS} days`);
    }
  }
  if (errors.length) fail(errors);
  return { title, destination, startDate, endDate };
};

// flightId is optional when creating a trip: a trip can start with or without a flight.
const validateOptionalFlightId = (req) => {
  const { flightId } = bodyOf(req);
  if (flightId === undefined || flightId === null) return undefined;
  if (!isId(flightId)) fail(['flightId must be a positive integer']);
  return flightId;
};

const validateFlightId = (req) => {
  const { flightId } = bodyOf(req);
  if (!isId(flightId)) fail(['flightId is required and must be a positive integer']);
  return flightId;
};

const validateTripId = (req) => readIdParam(req, 'tripId');
const validateTripFlightId = (req) => readIdParam(req, 'tripFlightId');
const validateDayNumber = (req) => readIdParam(req, 'dayNumber');
const validateItemId = (req) => readIdParam(req, 'itemId');

const validateTripFilters = (req) => {
  const errors = [];
  const search = readQueryText(req.query, 'search', errors);
  const { status } = req.query;
  if (status !== undefined && !TRIP_STATUSES.includes(status)) {
    errors.push(`status must be one of: ${TRIP_STATUSES.join(', ')}`);
  }
  if (errors.length) fail(errors);
  return { search, status };
};

// A place from the sample catalog (placeId) or from Google Places (googlePlaceId), not both.
// position is optional; leaving it out adds the place to the end of the day.
const validateNewItem = (req) => {
  const body = bodyOf(req);
  const errors = [];
  const hasLocal = body.placeId !== undefined;
  const hasGoogle = body.googlePlaceId !== undefined;
  if (hasLocal === hasGoogle) {
    errors.push('send either placeId (sample catalog) or googlePlaceId (Google Places), not both');
  } else if (hasLocal && !isId(body.placeId)) {
    errors.push('placeId must be a positive integer');
  } else if (hasGoogle && (typeof body.googlePlaceId !== 'string' || !GOOGLE_PLACE_ID.test(body.googlePlaceId))) {
    errors.push('googlePlaceId must be a Google place ID');
  }
  if (body.position !== undefined && !isId(body.position)) {
    errors.push('position must be a positive integer');
  }
  if (body.language !== undefined && (typeof body.language !== 'string' || !LANGUAGE.test(body.language))) {
    errors.push('language must be a language code such as en or zh-TW');
  }
  if (errors.length) fail(errors);
  return {
    placeId: body.placeId,
    googlePlaceId: body.googlePlaceId,
    position: body.position,
    language: body.language || 'en',
  };
};

const validateItemOrder = (req) => {
  const { itemIds } = bodyOf(req);
  if (!Array.isArray(itemIds) || !itemIds.every(isId)) {
    fail(['itemIds must be an array of item IDs']);
  }
  if (new Set(itemIds).size !== itemIds.length) fail(['itemIds must not contain duplicates']);
  return itemIds;
};

const validatePlaceFilters = (req) => {
  const errors = [];
  const city = readQueryText(req.query, 'city', errors);
  const category = readQueryText(req.query, 'category', errors);
  if (errors.length) fail(errors);
  return { city, category };
};

const readNumber = (query, field, min, max, errors, { required = true } = {}) => {
  const value = query[field];
  if (value === undefined) {
    if (required) errors.push(`${field} is required`);
    return undefined;
  }
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < min || number > max) {
    errors.push(`${field} must be a number from ${min} to ${max}`);
    return undefined;
  }
  return number;
};

const readLanguage = (query, errors) => {
  const { language } = query;
  if (language === undefined) return 'en';
  if (typeof language !== 'string' || !LANGUAGE.test(language)) {
    errors.push('language must be a language code such as en or zh-TW');
    return undefined;
  }
  return language;
};

// GET /api/places/nearby: the visible map area as a center and a radius in meters.
const validateNearby = (req) => {
  const errors = [];
  const lat = readNumber(req.query, 'lat', -90, 90, errors);
  const lng = readNumber(req.query, 'lng', -180, 180, errors);
  const radius = readNumber(req.query, 'radius', 100, 50000, errors, { required: false }) ?? 1500;
  const category = readQueryText(req.query, 'category', errors);
  if (category && !PLACE_CATEGORIES.includes(category)) {
    errors.push(`category must be one of: ${PLACE_CATEGORIES.join(', ')}`);
  }
  const language = readLanguage(req.query, errors);
  if (errors.length) fail(errors);
  return { lat, lng, radius: Math.round(radius), category, language };
};

// GET /api/places/locate?q=Tokyo
const validateLocate = (req) => {
  const errors = [];
  const q = readQueryText(req.query, 'q', errors);
  if (!q && !errors.length) errors.push('q is required, e.g. q=Tokyo');
  const language = readLanguage(req.query, errors);
  if (errors.length) fail(errors);
  return { q, language };
};

module.exports = {
  validateNearby,
  validateLocate,
  validateTrip,
  validateOptionalFlightId,
  validateFlightId,
  validateTripFlightId,
  validateTripId,
  validateDayNumber,
  validateItemId,
  validateTripFilters,
  validateNewItem,
  validateItemOrder,
  validatePlaceFilters,
};
