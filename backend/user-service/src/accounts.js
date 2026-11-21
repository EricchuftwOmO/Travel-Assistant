// Account logic shared by the GraphQL API and the REST login routes.
// Every function throws ApiError for an expected failure.

const ApiError = require('./helpers/ApiError');
const { hashPassword, checkPassword, signToken, verifyToken, bearerToken } = require('./helpers/authHelper');
const {
  validateRegistration,
  validateLogin,
  validateProfile,
  validateBasicInfo,
  validateLanguageSettings,
  validateTravelPreferences,
} = require('./helpers/validators');
const users = require('./data/userQueries');

const UNIQUE_VIOLATION = '23505';
const TRIP_SERVICE_URL = process.env.TRIP_SERVICE_URL || 'http://localhost:3001';
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS) || 5000;

const rejectDuplicateEmail = (err) => {
  if (err.code === UNIQUE_VIOLATION) throw new ApiError(409, 'Email is already registered');
  throw err;
};

const register = async (input) => {
  const { firstName, lastName, email, password } = validateRegistration(input);
  const passwordHash = await hashPassword(password);
  const user = await users
    .createUser({ firstName, lastName, email, passwordHash })
    .catch(rejectDuplicateEmail);
  return { user, token: signToken(user.id) };
};

const login = async (input) => {
  const { email, password } = validateLogin(input);
  const account = await users.findCredentialsByEmail(email);

  // The same message for both cases avoids revealing which emails are registered.
  if (!account || !(await checkPassword(password, account.passwordHash))) {
    throw new ApiError(401, 'Email or password is incorrect');
  }

  const { passwordHash, ...user } = account;
  return { user, token: signToken(user.id) };
};

// The signed-in user for an Authorization header, or null when there is no valid token.
// A token outlives its account, so a deleted user also gives null.
const userFromHeader = async (authorization) => {
  const token = bearerToken(authorization);
  if (!token) return null;
  try {
    const { userId } = verifyToken(token);
    return await users.findUserById(userId);
  } catch {
    return null;
  }
};

const updateProfile = async (userId, input) => {
  const profile = validateProfile(input);
  return users.updateUser(userId, profile).catch(rejectDuplicateEmail);
};

// The three tabs of the My Profile page.
const updateBasicInfo = (userId, input) => users.updateUser(userId, validateBasicInfo(input));

const updateLanguageSettings = async (userId, input) => {
  const user = await users.updateUser(userId, validateLanguageSettings(input));
  return { language: user.language, timezone: user.timezone };
};

const getTravelPreferences = (userId) => users.findTravelPreferences(userId);

const updateTravelPreferences = (userId, input) =>
  users.saveTravelPreferences(userId, validateTravelPreferences(input));

// The trip service owns the trips, so it is asked to delete them first, with the
// user's own token. If it cannot, the account is kept so nothing is left orphaned.
const deleteAccount = async (userId, authorization) => {
  let response;
  try {
    response = await fetch(new URL('/internal/my-data', TRIP_SERVICE_URL), {
      method: 'DELETE',
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(502, 'The trip service is unavailable, so the account was not deleted');
  }
  if (!response.ok) {
    throw new ApiError(502, `The trip service could not delete the trips (${response.status}); the account was kept`);
  }
  await users.deleteUser(userId);
};

module.exports = {
  register,
  login,
  userFromHeader,
  updateProfile,
  updateBasicInfo,
  updateLanguageSettings,
  getTravelPreferences,
  updateTravelPreferences,
  deleteAccount,
};
