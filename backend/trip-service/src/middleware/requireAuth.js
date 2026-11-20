const ApiError = require('../helpers/ApiError');
const { verifyToken } = require('../helpers/authHelper');

const unauthorized = (res, message) => {
  res.set('WWW-Authenticate', 'Bearer');
  return new ApiError(401, message);
};

// Checks the bearer token again (the gateway already did) so the service is safe
// on its own. Accounts live in the user service; here a user is just the token's id.
// When an account is deleted, the user service first deletes its trips here.
const requireAuth = (req, res, next) => {
  const [scheme, token] = (req.get('Authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw unauthorized(res, 'A bearer token is required');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw unauthorized(res, 'Token is invalid or expired');
  }
  if (!Number.isInteger(payload.userId) || payload.userId < 1) {
    throw unauthorized(res, 'Token is invalid or expired');
  }

  req.user = { id: payload.userId };
  next();
};

module.exports = requireAuth;
