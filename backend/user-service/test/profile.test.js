// My Profile: validation of the three tabs, and auth on the profile operations (no database needed).

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@127.0.0.1:1/none';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
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

let server;
let base;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const gql = async (query) => {
  const res = await fetch(`${base}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return { status: res.status, body: await res.json() };
};

test('profile mutations need a token', async () => {
  for (const mutation of [
    'mutation { updateBasicInfo(input: { firstName: "A" }) { id } }',
    'mutation { updateLanguageSettings(input: { language: "en" }) { language } }',
    'mutation { updateTravelPreferences(input: { budgetLevel: LUXURY }) { budgetLevel } }',
  ]) {
    const { body } = await gql(mutation);
    assert.equal(body.errors[0].extensions.code, 'UNAUTHENTICATED', mutation);
  }
});

test('profile queries are null without a token', async () => {
  const { body } = await gql('{ myLanguageSettings { language } myTravelPreferences { budgetLevel } }');
  assert.deepEqual(body.data, { myLanguageSettings: null, myTravelPreferences: null });
});

test('an unknown enum value is rejected by the schema', async () => {
  const { status } = await gql('mutation { updateBasicInfo(input: { gender: ROBOT }) { id } }');
  assert.equal(status, 400);
});
