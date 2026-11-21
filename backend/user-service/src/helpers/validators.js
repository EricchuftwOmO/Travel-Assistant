const ApiError = require('./ApiError');

const MAX_PASSWORD_BYTES = 72; // bcrypt ignores anything past 72 bytes
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_PATTERN = /^\+?[0-9][0-9 ().-]{3,28}$/;
const LANGUAGE_PATTERN = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/; // e.g. en, ja, zh-TW
const TRAVEL_STYLES = ['ADVENTURE', 'NATURE', 'CULTURE', 'FOOD', 'RELAXATION'];

const fail = (details) => {
  throw new ApiError(400, 'Request validation failed', details);
};

const asObject = (input) => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    fail(['Request body must be a JSON object']);
  }
  return input;
};

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

// An optional field: undefined = leave unchanged, null or '' = clear it, otherwise a trimmed string.
const readOptionalText = (body, field, maxLength, errors) => {
  const value = body[field];
  if (value === undefined) return undefined;
  if (value === null || (typeof value === 'string' && value.trim() === '')) return null;
  if (typeof value !== 'string' || value.includes('\0')) {
    errors.push(`${field} must be a string`);
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

// "Chun-Wei Chu" -> { firstName: "Chun-Wei", lastName: "Chu" }; one word is a first name only.
const splitName = (name) => {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? { firstName: parts[0], lastName: '' }
    : { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
};

const isRealDate = (value) => {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const isTimezone = (value) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

// Registration takes either "name" or "firstName" (+ optional "lastName").
const validateRegistration = (input) => {
  const body = asObject(input);
  const errors = [];
  let names;
  if (body.firstName !== undefined) {
    const firstName = readText(body, 'firstName', 50, errors);
    const lastName = readOptionalText(body, 'lastName', 50, errors) || '';
    names = { firstName, lastName };
  } else {
    const name = readText(body, 'name', 100, errors);
    names = name ? splitName(name) : {};
  }
  const email = readEmail(body, errors);
  const { password } = body;
  if (typeof password !== 'string' || password.length < 8) {
    errors.push('password must be at least 8 characters');
  } else if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    errors.push(`password must be at most ${MAX_PASSWORD_BYTES} bytes`);
  }
  if (errors.length) fail(errors);
  return { ...names, email, password };
};

const validateLogin = (input) => {
  const body = asObject(input);
  const errors = [];
  const email = readEmail(body, errors);
  if (typeof body.password !== 'string' || body.password === '') {
    errors.push('password is required');
  }
  if (errors.length) fail(errors);
  return { email, password: body.password };
};

// updateMe: the older "name + email" update.
const validateProfile = (input) => {
  const body = asObject(input);
  const errors = [];
  const name = readText(body, 'name', 100, errors);
  const email = readEmail(body, errors);
  if (errors.length) fail(errors);
  return { ...splitName(name), email };
};

// Basic Information tab. Only the fields sent are changed. Gender arrives already checked by the
// GraphQL enum. Email is not here: changing it needs a separate verification step.
const validateBasicInfo = (input) => {
  const body = asObject(input);
  const errors = [];
  const changes = {};

  for (const field of ['firstName', 'lastName']) {
    if (body[field] === undefined) continue;
    if (body[field] === null) {
      errors.push(`${field} cannot be empty`);
      continue;
    }
    changes[field] = readText(body, field, 50, errors);
  }
  if (body.gender !== undefined) changes.gender = body.gender;

  if (body.dateOfBirth !== undefined) {
    const value = body.dateOfBirth;
    if (value === null || value === '') {
      changes.dateOfBirth = null;
    } else if (typeof value !== 'string' || !isRealDate(value)) {
      errors.push('dateOfBirth must be a valid date in YYYY-MM-DD format');
    } else if (value < '1900-01-01' || value > new Date().toISOString().slice(0, 10)) {
      errors.push('dateOfBirth must be between 1900-01-01 and today');
    } else {
      changes.dateOfBirth = value;
    }
  }

  const phone = readOptionalText(body, 'phone', 30, errors);
  if (phone && !PHONE_PATTERN.test(phone)) {
    errors.push('phone may contain only digits, spaces, +, -, ( and ), e.g. +1 (253) 555-0198');
  }
  if (phone !== undefined) changes.phone = phone;

  const country = readOptionalText(body, 'country', 60, errors);
  if (country !== undefined) changes.country = country;

  if (errors.length) fail(errors);
  return changes;
};

// Language & Timezone tab.
const validateLanguageSettings = (input) => {
  const body = asObject(input);
  const errors = [];
  const changes = {};
  if (body.language != null) {
    if (typeof body.language !== 'string' || !LANGUAGE_PATTERN.test(body.language)) {
      errors.push('language must be a language code such as en or zh-TW');
    } else {
      changes.language = body.language;
    }
  }
  if (body.timezone != null) {
    if (typeof body.timezone !== 'string' || !isTimezone(body.timezone)) {
      errors.push('timezone must be an IANA time zone such as Asia/Taipei');
    } else {
      changes.timezone = body.timezone;
    }
  }
  if (errors.length) fail(errors);
  return changes;
};

// Travel Preferences tab. Enum values are already checked by GraphQL; duplicates are dropped.
const validateTravelPreferences = (input) => {
  const body = asObject(input);
  const changes = {};
  if (body.budgetLevel !== undefined) changes.budgetLevel = body.budgetLevel;
  if (body.travelStyles !== undefined && body.travelStyles !== null) {
    if (!Array.isArray(body.travelStyles) || !body.travelStyles.every((s) => TRAVEL_STYLES.includes(s))) {
      fail([`travelStyles must be a list of: ${TRAVEL_STYLES.join(', ')}`]);
    }
    changes.travelStyles = [...new Set(body.travelStyles)];
  }
  return changes;
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateProfile,
  validateBasicInfo,
  validateLanguageSettings,
  validateTravelPreferences,
};
