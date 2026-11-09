const ApiError = require('../helpers/ApiError');
const { verifyToken } = require('../helpers/authHelper');
const { findUserById } = require('../data/userQueries');

const unauthorized = (res, message) => {
  res.set('WWW-Authenticate', 'Bearer');
  return new ApiError(401, message);
};

// Confirms the bearer token and attaches the signed-in user as req.user.
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
  // next() 的意思是「這一關通過了，交給下一個函式處理」。 在 requireAuth 裡，它代表身分驗證成功，可以繼續執行後面的 controller。
  next();
};

module.exports = requireAuth;
