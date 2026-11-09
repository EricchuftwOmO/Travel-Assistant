const ApiError = require('./ApiError');
const { countDays } = require('./dates');

const MAX_ID = 2147483647; // largest value of a PostgreSQL INTEGER
const MAX_PASSWORD_BYTES = 72; // bcrypt ignores anything past 72 bytes
const MAX_TRIP_DAYS = 90; // every day becomes an itinerary row, so length is capped
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TRIP_STATUSES = ['upcoming', 'past'];

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

const readEmail = (body, errors) => {
  const email = readText(body, 'email', 254, errors);
  if (email && !EMAIL_PATTERN.test(email)) errors.push('email must be a valid email address');
  return email && email.toLowerCase();
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

const validateRegistration = (req) => {
  const body = bodyOf(req);
  const errors = [];
  const name = readText(body, 'name', 100, errors);
  const email = readEmail(body, errors);
  const { password } = body;
  if (typeof password !== 'string' || password.length < 8) {
    errors.push('password must be at least 8 characters');
  } else if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    errors.push(`password must be at most ${MAX_PASSWORD_BYTES} bytes`);
  }
  if (errors.length) fail(errors);
  return { name, email, password };
};

const validateLogin = (req) => {
  const body = bodyOf(req);
  const errors = [];
  const email = readEmail(body, errors);
  if (typeof body.password !== 'string' || body.password === '') {
    errors.push('password is required');
  }
  if (errors.length) fail(errors);
  return { email, password: body.password };
};

const validateProfile = (req) => {
  const body = bodyOf(req);
  const errors = [];
  const name = readText(body, 'name', 100, errors);
  const email = readEmail(body, errors);
  if (errors.length) fail(errors);
  return { name, email };
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

const validateTripId = (req) => readIdParam(req, 'tripId');
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

// position is optional; leaving it out adds the place to the end of the day.
const validateNewItem = (req) => {
  const body = bodyOf(req);
  const errors = [];
  if (!isId(body.placeId)) errors.push('placeId is required and must be a positive integer');
  if (body.position !== undefined && !isId(body.position)) {
    errors.push('position must be a positive integer');
  }
  if (errors.length) fail(errors);
  return { placeId: body.placeId, position: body.position };
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

module.exports = {
  validateRegistration,
  validateLogin,
  validateProfile,
  validateTrip,
  validateTripId,
  validateDayNumber,
  validateItemId,
  validateTripFilters,
  validateNewItem,
  validateItemOrder,
  validatePlaceFilters,
};
