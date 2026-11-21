const ApiError = require('../helpers/ApiError');
const accounts = require('../accounts');

// Checks the bearer token and loads the account (a token outlives its account, so a deleted
// user is rejected too). The user is put on req.user.
const requireUser = async (req, res, next) => {
  const user = await accounts.userFromHeader(req.get('Authorization'));
  if (!user) {
    res.set('WWW-Authenticate', 'Bearer');
    throw new ApiError(401, 'A valid bearer token is required');
  }
  req.user = user;
  next();
};

module.exports = requireUser;
