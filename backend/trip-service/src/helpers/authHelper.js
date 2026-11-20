const jwt = require('jsonwebtoken');

// Login tokens are issued by the user service. This service only checks them,
// with the same JWT_SECRET.
const ALGORITHM = 'HS256';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Copy .env.example to .env and set a value.');
}

// Throws if the token is malformed, expired, or has a bad signature.
const verifyToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET, { algorithms: [ALGORITHM] });

module.exports = { verifyToken };
