const ApiError = require('../helpers/ApiError');

// Logins are not checked here. The API gateway asks the user service whether the bearer token is valid,
// then sends the user's id as X-User-Id (and removes any X-User-Id a client sent). The user service
// calls /internal/my-data directly with the same header. So this service must only be reachable
// through the gateway and the user service; the published port in docker-compose is for development.
const requireAuth = (req, res, next) => {
  const userId = Number(req.get('X-User-Id'));
  if (!/^\d+$/.test(req.get('X-User-Id') || '') || !Number.isSafeInteger(userId) || userId < 1) {
    res.set('WWW-Authenticate', 'Bearer');
    throw new ApiError(401, 'A signed-in user is required (X-User-Id comes from the API gateway)');
  }

  req.user = { id: userId };
  next();
};

module.exports = requireAuth;
