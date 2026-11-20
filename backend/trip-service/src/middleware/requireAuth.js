const ApiError = require('../helpers/ApiError');
const { verifyToken } = require('../helpers/authHelper');
const { findUserById } = require('../data/userQueries');

const unauthorized = (res, message) => {
  res.set('WWW-Authenticate', 'Bearer');
  return new ApiError(401, message);
};

const requireAuth = async (req, res, next) => {
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

  // A token outlives its account, so a deleted user must be rejected here.
  const user = await findUserById(payload.userId);
  if (!user) throw unauthorized(res, 'Token is invalid or expired');

  req.user = user;
  next();
};

module.exports = requireAuth;
