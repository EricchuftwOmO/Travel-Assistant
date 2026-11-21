const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 10;
const TOKEN_LIFETIME = '1h';
const ALGORITHM = 'HS256';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Copy .env.example to .env and set a value.');
}

const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);
const checkPassword = (password, hash) => bcrypt.compare(password, hash);

// The gateway and the trip service verify this token with the same JWT_SECRET.
const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: TOKEN_LIFETIME,
  });

// Throws if the token is malformed, expired, or has a bad signature.
const verifyToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET, { algorithms: [ALGORITHM] });

// The bearer token from an Authorization header, or null.
const bearerToken = (header) => {
  const [scheme, token] = (header || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
};

module.exports = { hashPassword, checkPassword, signToken, verifyToken, bearerToken };
