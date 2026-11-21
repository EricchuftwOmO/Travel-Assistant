// Every request goes through the API gateway's GraphQL API (it calls the user, trip, flight and LLM
// services). The helpers below are grouped by what they are about.

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

const TOKEN_KEY = 'travel-assistant-token';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the session lasts until reload */
  }
};

// Called when the gateway rejects the token, so the app can return to the login screen.
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// GraphQL call to the gateway: the only way this app talks to the backend. Returns `data`, or throws an
// ApiError with the first error's message (and the field problems in .details).
// If the gateway says the saved token is no good (UNAUTHENTICATED), the user is signed out, except for
// calls with keepSession (login, register, Google): there a wrong password must show an error instead.
export async function gql(query, variables, { keepSession = false } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}/api/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new ApiError(0, `Cannot reach the API gateway at ${API_URL}. Is it running?`);
  }
  const data = await res.json().catch(() => null);
  const error = data?.errors?.[0] || (!res.ok && (data?.error || { message: `Request failed (${res.status})` }));
  if (error) {
    const status = error.extensions?.status || res.status;
    if (!keepSession && getToken() && (error.extensions?.code === 'UNAUTHENTICATED' || status === 401)) onUnauthorized();
    throw new ApiError(status, error.message, error.extensions?.details || error.details);
  }
  return data.data;
}

const USER_FIELDS = 'id name firstName lastName email createdAt';

export const userApi = {
  me: () => gql(`query { me { ${USER_FIELDS} } }`).then((d) => d.me),
  login: (email, password) =>
    gql(
      `mutation Login($email: String!, $password: String!) {
        login(email: $email, password: $password) { token user { ${USER_FIELDS} } }
      }`,
      { email, password },
      { keepSession: true }
    ).then((d) => d.login),
  // credential is the ID token from Google Sign-In; the first sign-in creates the account.
  loginWithGoogle: (credential) =>
    gql(
      `mutation GoogleLogin($credential: String!) {
        loginWithGoogle(credential: $credential) { token user { ${USER_FIELDS} } }
      }`,
      { credential },
      { keepSession: true }
    ).then((d) => d.loginWithGoogle),
  register: (input) =>
    gql(
      `mutation Register($input: RegisterInput!) {
        register(input: $input) { token user { ${USER_FIELDS} } }
      }`,
      { input },
      { keepSession: true }
    ).then((d) => d.register),
};

const PROFILE_FIELDS = `id name firstName lastName email gender dateOfBirth phone country createdAt
  languageSettings { language timezone }
  travelPreferences { budgetLevel travelStyles }`;

// My Profile page. save() sends only the tabs that changed, as one GraphQL request
// with up to three mutations, so the page saves everything in a single round trip.
export const profileApi = {
  load: () => gql(`query Profile { me { ${PROFILE_FIELDS} } }`).then((d) => d.me),

  save: async ({ basicInfo, languageSettings, travelPreferences }) => {
    const variables = {};
    const params = [];
    const fields = [];
    if (basicInfo) {
      variables.basic = basicInfo;
      params.push('$basic: UpdateBasicInfoInput!');
      fields.push(`updateBasicInfo(input: $basic) { ${PROFILE_FIELDS} }`);
    }
    if (languageSettings) {
      variables.language = languageSettings;
      params.push('$language: UpdateLanguageSettingsInput!');
      fields.push('updateLanguageSettings(input: $language) { language timezone }');
    }
    if (travelPreferences) {
      variables.prefs = travelPreferences;
      params.push('$prefs: UpdateTravelPreferencesInput!');
      fields.push('updateTravelPreferences(input: $prefs) { budgetLevel travelStyles }');
    }
    if (!fields.length) return {};
    const body = fields.map((field) => `  ${field}`).join('\n');
    return gql(`mutation SaveProfile(${params.join(', ')}) {\n${body}\n}`, variables);
  },
};

// ---------- Trips, itineraries, flights on trips ----------

const TRIP_FIELDS = 'id ownerId title destination startDate endDate createdAt';
const TRIP_FLIGHT_FIELDS =
  'id tripId flightId airline flightNumber origin destination departAt arriveAt price currency createdAt';
const PLACE_FIELDS = 'id googlePlaceId name city category address lat lng';
const DAY_FIELDS = `id tripId dayNumber date placeCount items { id position place { ${PLACE_FIELDS} } }`;

export const tripsApi = {
  // status: 'upcoming' | 'past' | '' (all); search: part of the title
  list: ({ status, search } = {}) =>
    gql(
      `query MyTrips($status: TripStatus, $search: String) {
        myTrips(status: $status, search: $search) { ${TRIP_FIELDS} }
      }`,
      { status: status || null, search: search || null }
    ).then((d) => d.myTrips),

  // The trip with its flights and its days (without their places), in one request
  get: (id) =>
    gql(
      `query Trip($id: ID!) {
        trip(id: $id) {
          ${TRIP_FIELDS}
          flights { ${TRIP_FLIGHT_FIELDS} }
          itineraries { id dayNumber date placeCount }
        }
      }`,
      { id }
    ).then((d) => {
      if (!d.trip) throw new ApiError(404, 'Trip not found');
      return d.trip;
    }),

  // input: { title, destination, startDate, endDate, flightId? }
  create: (input) =>
    gql(
      `mutation CreateTrip($input: CreateTripInput!) { createTrip(input: $input) { ${TRIP_FIELDS} } }`,
      { input }
    ).then((d) => d.createTrip),

  update: (id, { title, destination, startDate, endDate }) =>
    gql(
      `mutation UpdateTrip($id: ID!, $input: TripInput!) { updateTrip(id: $id, input: $input) { ${TRIP_FIELDS} } }`,
      { id, input: { title, destination, startDate, endDate } }
    ).then((d) => d.updateTrip),

  remove: (id) => gql('mutation DeleteTrip($id: ID!) { deleteTrip(id: $id) }', { id }),

  attachFlight: (tripId, flightId) =>
    gql(
      `mutation AttachFlight($tripId: ID!, $flightId: ID!) {
        attachFlight(tripId: $tripId, flightId: $flightId) { ${TRIP_FLIGHT_FIELDS} }
      }`,
      { tripId, flightId }
    ).then((d) => d.attachFlight),

  // tripFlightId is the attached flight's own id (TripFlight.id)
  detachFlight: (tripId, tripFlightId) =>
    gql('mutation DetachFlight($tripId: ID!, $tripFlightId: ID!) { detachFlight(tripId: $tripId, tripFlightId: $tripFlightId) }', {
      tripId,
      tripFlightId,
    }),

  // One day with its places in visiting order
  day: (tripId, dayNumber) =>
    gql(
      `query Day($tripId: ID!, $dayNumber: Int!) { itineraryDay(tripId: $tripId, dayNumber: $dayNumber) { ${DAY_FIELDS} } }`,
      { tripId, dayNumber }
    ).then((d) => {
      if (!d.itineraryDay) throw new ApiError(404, 'Day not found');
      return d.itineraryDay;
    }),

  // input: { placeId } (sample catalog) or { googlePlaceId }, plus position
  addItem: (tripId, dayNumber, input) =>
    gql(
      `mutation AddItem($tripId: ID!, $dayNumber: Int!, $input: NewItineraryItemInput!) {
        addItineraryItem(tripId: $tripId, dayNumber: $dayNumber, input: $input) { id position place { ${PLACE_FIELDS} } }
      }`,
      { tripId, dayNumber, input }
    ).then((d) => d.addItineraryItem),

  removeItem: (tripId, dayNumber, itemId) =>
    gql(
      'mutation RemoveItem($tripId: ID!, $dayNumber: Int!, $itemId: ID!) { removeItineraryItem(tripId: $tripId, dayNumber: $dayNumber, itemId: $itemId) }',
      { tripId, dayNumber, itemId }
    ),

  // itemIds: every item of the day, in the new order. Returns the day.
  reorder: (tripId, dayNumber, itemIds) =>
    gql(
      `mutation Reorder($tripId: ID!, $dayNumber: Int!, $itemIds: [ID!]!) {
        reorderItineraryItems(tripId: $tripId, dayNumber: $dayNumber, itemIds: $itemIds) { ${DAY_FIELDS} }
      }`,
      { tripId, dayNumber, itemIds }
    ).then((d) => d.reorderItineraryItems),
};

// ---------- Places ----------

export const placesApi = {
  // The sample catalog (works without Google)
  catalog: ({ city, category } = {}) =>
    gql(
      `query Places($city: String, $category: PlaceCategory) { places(city: $city, category: $category) { ${PLACE_FIELDS} } }`,
      { city: city || null, category: category || null }
    ).then((d) => d.places),

  // { googlePlaces: boolean }: can the Google map be used?
  config: () => gql('query { placesConfig { googlePlaces } }').then((d) => d.placesConfig),

  nearby: ({ lat, lng, radius, category }) =>
    gql(
      `query Nearby($lat: Float!, $lng: Float!, $radius: Int, $category: PlaceCategory) {
        nearbyPlaces(lat: $lat, lng: $lng, radius: $radius, category: $category) {
          googlePlaceId name address lat lng category type rating ratingCount
        }
      }`,
      { lat, lng, radius, category: category || null }
    ).then((d) => d.nearbyPlaces),

  // Where a destination is, to centre the map. A 404 ApiError if Google finds nothing.
  locate: (query) =>
    gql('query Locate($query: String!) { locatePlace(query: $query) { name lat lng viewport { north east south west } } }', {
      query,
    }).then((d) => {
      if (!d.locatePlace) throw new ApiError(404, `No location found for "${query}"`);
      return d.locatePlace;
    }),
};

// ---------- Flights (public catalog) ----------

const FLIGHT_FIELDS = 'id airline flightNumber origin destination departAt arriveAt price currency seatsAvailable';

export const flightsApi = {
  // criteria: { origin, destination, departDate (YYYY-MM-DD), maxPrice }, cheapest first
  search: ({ origin, destination, departDate, maxPrice } = {}) =>
    gql(
      `query Flights($origin: String, $destination: String, $departDate: String, $maxPrice: Float) {
        flights(origin: $origin, destination: $destination, departDate: $departDate, maxPrice: $maxPrice,
                sort: price, order: asc, limit: 50) { ${FLIGHT_FIELDS} }
      }`,
      {
        origin: origin?.trim() || null,
        destination: destination?.trim() || null,
        departDate: departDate?.trim() || null,
        maxPrice: String(maxPrice ?? '').trim() ? Number(maxPrice) : null,
      }
    ).then((d) => d.flights),
};

// ---------- AI advice (the user id is never sent: the gateway knows who is signed in) ----------

const ADVICE_FIELDS = 'id tripId topic prompt content source createdAt';

export const adviceApi = {
  recent: (tripId, limit = 5) =>
    gql(`query Advice($tripId: ID, $limit: Int) { myAdvice(tripId: $tripId, limit: $limit) { ${ADVICE_FIELDS} } }`, {
      tripId,
      limit,
    }).then((d) => d.myAdvice),

  ask: ({ tripId, topic, prompt }) =>
    gql(
      `mutation Ask($tripId: ID, $topic: AdviceTopic, $prompt: String!) {
        askAdvice(tripId: $tripId, topic: $topic, prompt: $prompt) { ${ADVICE_FIELDS} }
      }`,
      { tripId, topic, prompt }
    ).then((d) => d.askAdvice),
};
