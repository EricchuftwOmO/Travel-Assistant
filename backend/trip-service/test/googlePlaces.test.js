// The Google Places client with fetch replaced by a fake: request shape, field masks,
// response mapping, caching and error handling. No network or API key needed.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let calls = [];
let reply = () => ({ status: 200, body: {} });

global.fetch = async (url, options) => {
  calls.push({ url, ...options, headers: options.headers, body: options.body && JSON.parse(options.body) });
  const { status, body } = reply(url, options);
  return { ok: status >= 200 && status < 300, status, json: async () => body };
};

const fresh = () => {
  delete require.cache[require.resolve('../src/helpers/googlePlaces')];
  return require('../src/helpers/googlePlaces');
};

beforeEach(() => {
  calls = [];
  process.env.GOOGLE_PLACES_API_KEY = 'test-key';
});

const TAIPEI_101 = {
  id: 'ChIJH56c2rarQjQRphD9gvC8BhI',
  displayName: { text: 'Taipei 101' },
  shortFormattedAddress: 'No. 7, Section 5, Xinyi Rd, Xinyi District',
  location: { latitude: 25.0339639, longitude: 121.5644722 },
  types: ['tourist_attraction', 'point_of_interest'],
  primaryTypeDisplayName: { text: 'Tourist attraction' },
  rating: 4.6,
  userRatingCount: 98765,
};

test('without a key every call is a 503, and nothing is sent to Google', async () => {
  process.env.GOOGLE_PLACES_API_KEY = '';
  const google = fresh();
  assert.equal(google.isConfigured(), false);
  await assert.rejects(google.searchNearby({ lat: 25, lng: 121, radius: 1000, language: 'en' }), { status: 503 });
  assert.equal(calls.length, 0);
});

test('nearby search sends the key, a field mask, the types and the circle', async () => {
  reply = () => ({ status: 200, body: { places: [TAIPEI_101] } });
  const google = fresh();
  const results = await google.searchNearby({ lat: 25.03, lng: 121.56, radius: 1500, category: 'attraction', language: 'en' });

  const [call] = calls;
  assert.equal(call.url, 'https://places.googleapis.com/v1/places:searchNearby');
  assert.equal(call.headers['X-Goog-Api-Key'], 'test-key');
  assert.match(call.headers['X-Goog-FieldMask'], /places\.id/);
  assert.deepEqual(call.body.includedTypes, ['tourist_attraction']);
  assert.deepEqual(call.body.excludedPrimaryTypes, ['hotel', 'lodging']);
  assert.deepEqual(call.body.locationRestriction.circle, { center: { latitude: 25.03, longitude: 121.56 }, radius: 1500 });

  assert.deepEqual(results[0], {
    googlePlaceId: TAIPEI_101.id,
    name: 'Taipei 101',
    address: 'No. 7, Section 5, Xinyi Rd, Xinyi District',
    lat: 25.0339639,
    lng: 121.5644722,
    category: 'attraction',
    type: 'Tourist attraction',
    rating: 4.6,
    ratingCount: 98765,
  });
});

test('a department store with a cafe is not a Food result, and is labeled by its primary type', async () => {
  const store = { ...TAIPEI_101, id: 'store', primaryType: 'department_store', types: ['department_store', 'cafe'] };
  reply = () => ({ status: 200, body: { places: [store] } });
  const google = fresh();
  const [place] = await google.searchNearby({ lat: 35.69, lng: 139.7, radius: 1500, category: 'food', language: 'en' });
  assert.ok(calls[0].body.excludedPrimaryTypes.includes('department_store'));
  assert.equal(place.category, 'shopping');
});

test('the same area is answered from the cache', async () => {
  reply = () => ({ status: 200, body: { places: [TAIPEI_101] } });
  const google = fresh();
  const query = { lat: 25.03, lng: 121.56, radius: 1500, category: 'food', language: 'en' };
  await google.searchNearby(query);
  await google.searchNearby({ ...query, lat: 25.0301 }); // a few meters away
  assert.equal(calls.length, 1);
});

test('a rejected key becomes 502 and a quota error 503, without Google details', async () => {
  const google = fresh();
  reply = () => ({ status: 403, body: { error: { message: 'API key not valid' } } });
  await assert.rejects(google.searchNearby({ lat: 1, lng: 1, radius: 500, language: 'en' }), { status: 502 });
  reply = () => ({ status: 429, body: { error: { message: 'quota' } } });
  await assert.rejects(google.searchNearby({ lat: 2, lng: 2, radius: 500, language: 'en' }), { status: 503 });
});

test('place details give the city from the address components', async () => {
  reply = () => ({
    status: 200,
    body: {
      ...TAIPEI_101,
      formattedAddress: 'No. 7, Section 5, Xinyi Rd, Xinyi District, Taipei City, Taiwan 110',
      addressComponents: [
        { longText: 'Xinyi District', types: ['administrative_area_level_2'] },
        { longText: 'Taipei City', types: ['administrative_area_level_1'] },
        { longText: 'Taiwan', types: ['country'] },
      ],
    },
  });
  const place = await fresh().getPlace(TAIPEI_101.id, 'en');
  assert.equal(place.city, 'Taipei City');
  assert.equal(place.address, 'No. 7, Section 5, Xinyi Rd, Xinyi District, Taipei City, Taiwan 110');
  assert.match(calls[0].url, /\/places\/ChIJH56c2rarQjQRphD9gvC8BhI\?languageCode=en$/);
});

test('an unknown place ID gives null (the caller answers 400)', async () => {
  reply = () => ({ status: 404, body: { error: { message: 'not found' } } });
  assert.equal(await fresh().getPlace('ChIJ_does_not_exist', 'en'), null);
});

test('locate returns the location and viewport of a destination', async () => {
  reply = () => ({
    status: 200,
    body: {
      places: [{
        id: 'x', displayName: { text: 'Tokyo' }, location: { latitude: 35.68, longitude: 139.76 },
        viewport: { low: { latitude: 35.5, longitude: 139.5 }, high: { latitude: 35.8, longitude: 139.9 } },
      }],
    },
  });
  const location = await fresh().locate('Tokyo', 'en');
  assert.deepEqual(location, {
    name: 'Tokyo', lat: 35.68, lng: 139.76,
    viewport: { north: 35.8, east: 139.9, south: 35.5, west: 139.5 },
  });
  assert.equal(calls[0].body.textQuery, 'Tokyo');
});
