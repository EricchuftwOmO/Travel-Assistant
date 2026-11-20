// Client for Google Places API (New). The key stays here on the server; the browser only
// talks to this service. Docs: https://developers.google.com/maps/documentation/places/web-service
//
// Google bills by the fields requested, so every call sends a field mask with only what the app shows.

const ApiError = require('./ApiError');

const BASE_URL = 'https://places.googleapis.com/v1';
const TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS) || 5000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

const apiKey = () => process.env.GOOGLE_PLACES_API_KEY || '';
const isConfigured = () => Boolean(apiKey());

// The app's categories and the Google place types each one searches for.
const CATEGORY_TYPES = {
  attraction: ['tourist_attraction'],
  food: ['restaurant', 'cafe'],
  museum: ['museum', 'art_gallery'],
  nature: ['park', 'national_park'],
  shopping: ['shopping_mall', 'department_store'],
};
const CATEGORIES = Object.keys(CATEGORY_TYPES);

// Google matches a type anywhere in a place's list, so a department store with a cafe inside counts
// as "cafe". These primary types are excluded so each category shows what it says.
const NOT_FOR_TRAVEL = ['hotel', 'lodging'];
const EXCLUDED_PRIMARY_TYPES = {
  all: NOT_FOR_TRAVEL,
  attraction: NOT_FOR_TRAVEL,
  food: [...NOT_FOR_TRAVEL, 'department_store', 'shopping_mall', 'movie_theater', 'supermarket', 'grocery_store', 'convenience_store'],
  museum: NOT_FOR_TRAVEL,
  nature: NOT_FOR_TRAVEL,
  shopping: NOT_FOR_TRAVEL,
};

// The other way: a Google place's types -> one of the app's categories (its primary type first).
const categoryOf = (types = [], primaryType) => {
  const primary = CATEGORIES.find((category) => CATEGORY_TYPES[category].includes(primaryType));
  if (primary) return primary;
  for (const category of CATEGORIES) {
    if (CATEGORY_TYPES[category].some((type) => types.includes(type))) return category;
  }
  if (types.some((type) => /restaurant|food|cafe|bakery|bar$/.test(type))) return 'food';
  if (types.some((type) => /store|shop|market/.test(type))) return 'shopping';
  return 'attraction';
};

// A small in-memory cache, so panning back and forth over the same area does not call Google again.
const cache = new Map();
const cached = async (key, load) => {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await load();
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
};

const call = async (path, { method = 'GET', fieldMask, body, notFoundOk = false }) => {
  if (!isConfigured()) {
    throw new ApiError(503, 'Google Places is not configured on the server (GOOGLE_PLACES_API_KEY)');
  }
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey(),
        'X-Goog-FieldMask': fieldMask,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(502, 'Google Places did not respond');
  }
  const data = await response.json().catch(() => ({}));
  if (response.ok) return data;

  const reason = data.error?.message || `status ${response.status}`;
  // Logged for the developer; the client gets a short message without Google's details.
  console.error(`[google-places] ${method} ${path} failed: ${reason}`);
  // An unknown or malformed place ID comes back as 404 or 400.
  if (notFoundOk && (response.status === 404 || response.status === 400)) return null;
  if (response.status === 403 || response.status === 401) {
    throw new ApiError(502, 'Google Places rejected the API key (check that Places API (New) is enabled for it)');
  }
  if (response.status === 429) throw new ApiError(503, 'Google Places quota exceeded; try again later');
  throw new ApiError(502, 'Google Places request failed');
};

// Google's place -> the shape this API returns.
const toPlace = (p) => ({
  googlePlaceId: p.id,
  name: p.displayName?.text || 'Unnamed place',
  address: p.formattedAddress || p.shortFormattedAddress || null,
  lat: p.location?.latitude ?? null,
  lng: p.location?.longitude ?? null,
  category: categoryOf(p.types, p.primaryType),
  type: p.primaryTypeDisplayName?.text || null,
  rating: p.rating ?? null,
  ratingCount: p.userRatingCount ?? null,
});

const LIST_FIELDS = [
  'places.id',
  'places.displayName',
  'places.shortFormattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.rating',
  'places.userRatingCount',
].join(',');

// Popular places of a category within a circle (the visible map area).
const searchNearby = ({ lat, lng, radius, category, language }) => {
  // Rounded to ~100 m and the radius to 10%, so tiny map moves reuse the cached answer.
  const key = ['nearby', lat.toFixed(3), lng.toFixed(3), Math.round(Math.log(radius) * 10), category || 'all', language].join('|');
  return cached(key, async () => {
    const includedTypes = category ? CATEGORY_TYPES[category] : CATEGORIES.flatMap((c) => CATEGORY_TYPES[c]);
    const data = await call('/places:searchNearby', {
      method: 'POST',
      fieldMask: LIST_FIELDS,
      body: {
        includedTypes,
        excludedPrimaryTypes: EXCLUDED_PRIMARY_TYPES[category || 'all'],
        maxResultCount: 20,
        rankPreference: 'POPULARITY',
        languageCode: language,
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
      },
    });
    return (data?.places || []).map(toPlace);
  });
};

// Where a destination such as "Tokyo" is, to center the map. Null when Google finds nothing.
const locate = (query, language) =>
  cached(['locate', query.toLowerCase(), language].join('|'), async () => {
    const data = await call('/places:searchText', {
      method: 'POST',
      fieldMask: 'places.id,places.displayName,places.location,places.viewport',
      body: { textQuery: query, pageSize: 1, languageCode: language },
    });
    const place = data?.places?.[0];
    if (!place?.location) return null;
    return {
      name: place.displayName?.text || query,
      lat: place.location.latitude,
      lng: place.location.longitude,
      viewport: place.viewport
        ? {
            north: place.viewport.high.latitude,
            east: place.viewport.high.longitude,
            south: place.viewport.low.latitude,
            west: place.viewport.low.longitude,
          }
        : null,
    };
  });

// One place's details, read when it is added to an itinerary (so the client cannot send made-up data).
// Null when Google does not know the ID.
const getPlace = async (googlePlaceId, language) => {
  const data = await call(`/places/${encodeURIComponent(googlePlaceId)}?languageCode=${encodeURIComponent(language)}`, {
    fieldMask: 'id,displayName,formattedAddress,location,types,primaryType,addressComponents',
    notFoundOk: true,
  });
  if (!data) return null;
  const components = data.addressComponents || [];
  const component = (type) => components.find((c) => c.types?.includes(type))?.longText;
  return {
    ...toPlace(data),
    city:
      component('locality') ||
      component('postal_town') ||
      component('administrative_area_level_1') ||
      component('administrative_area_level_2') ||
      component('country') ||
      'Unknown',
  };
};

module.exports = { isConfigured, searchNearby, locate, getPlace, CATEGORIES };
