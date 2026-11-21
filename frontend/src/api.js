// Every request goes through the API gateway. Users go through GraphQL (user service);
// trips, flights, places and advice are REST.

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

// REST call: returns parsed JSON (or null for 204), throws ApiError with the service's message.
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...authHeaders() },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Cannot reach the API gateway at ${API_URL}. Is it running?`);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && getToken()) onUnauthorized();
    const err = data?.error || {};
    throw new ApiError(res.status, err.message || `Request failed (${res.status})`, err.details);
  }
  return data;
}

// GraphQL call to the user service. Throws the first error's message.
export async function gql(query, variables) {
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
      { email, password }
    ).then((d) => d.login),
  register: (input) =>
    gql(
      `mutation Register($input: RegisterInput!) {
        register(input: $input) { token user { ${USER_FIELDS} } }
      }`,
      { input }
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
