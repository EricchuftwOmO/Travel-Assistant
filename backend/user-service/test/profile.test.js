// My Profile: validation of the three tabs (no database needed).

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@127.0.0.1:1/none';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateBasicInfo,
  validateLanguageSettings,
  validateTravelPreferences,
  validateRegistration,
} = require('../src/helpers/validators');

const detailsOf = (fn) => {
  try {
    fn();
  } catch (err) {
    return err.details;
  }
  assert.fail('expected a validation error');
};

test('basic info: only sent fields change, blanks clear optional fields', () => {
  assert.deepEqual(validateBasicInfo({ firstName: ' Chun-Wei ', phone: '', country: null }), {
    firstName: 'Chun-Wei',
    phone: null,
    country: null,
  });
});

test('basic info: reports every bad field', () => {
  const details = detailsOf(() =>
    validateBasicInfo({ firstName: null, dateOfBirth: '2000-02-30', phone: 'call me' })
  );
  assert.equal(details.length, 3);
});

test('basic info: date of birth cannot be in the future', () => {
  const details = detailsOf(() => validateBasicInfo({ dateOfBirth: '2999-01-01' }));
  assert.match(details[0], /between 1900-01-01 and today/);
});

test('language settings: checks the language code and the IANA time zone', () => {
  assert.deepEqual(validateLanguageSettings({ language: 'zh-TW', timezone: 'Asia/Taipei' }), {
    language: 'zh-TW',
    timezone: 'Asia/Taipei',
  });
  assert.equal(detailsOf(() => validateLanguageSettings({ language: 'Chinese', timezone: 'Mars/Base' })).length, 2);
});

test('travel preferences: duplicates are dropped', () => {
  assert.deepEqual(validateTravelPreferences({ travelStyles: ['FOOD', 'FOOD', 'NATURE'] }), {
    travelStyles: ['FOOD', 'NATURE'],
  });
});

test('registration splits a full name into first and last name', () => {
  const { firstName, lastName } = validateRegistration({
    name: 'Chun-Wei Chu',
    email: 'cw@example.com',
    password: 'Password123!',
  });
  assert.deepEqual({ firstName, lastName }, { firstName: 'Chun-Wei', lastName: 'Chu' });
});

test('gender and budget level must be known values', () => {
  assert.match(detailsOf(() => validateBasicInfo({ gender: 'ROBOT' }))[0], /gender must be one of/);
  assert.match(detailsOf(() => validateTravelPreferences({ budgetLevel: 'FREE' }))[0], /budgetLevel must be one of/);
  assert.deepEqual(validateBasicInfo({ gender: null }), { gender: null });
});
