const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const SALT_ROUNDS = 10;
const TOKEN_LIFETIME = '1h';
const ALGORITHM = 'HS256';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Copy .env.example to .env and set a value.');
}

const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);
const checkPassword = (password, hash) => bcrypt.compare(password, hash);

// Only the user service knows JWT_SECRET; the gateway asks GET /api/auth/validate to check a token.
const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: TOKEN_LIFETIME,
  });

// Throws if the token is malformed, expired, or has a bad signature.
const verifyToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET, { algorithms: [ALGORITHM] });

// Checks a Google ID token (signature, expiry, issued for this app's client ID).
// Returns { sub, email, name, givenName, familyName }; throws if it is not valid.
const verifyGoogleToken = async (idToken) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload.email || !payload.email_verified) throw new Error('Google email is not verified');
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name,
    givenName: payload.given_name,
    familyName: payload.family_name,
  };
};

// The bearer token from an Authorization header, or null.
const bearerToken = (header) => {
  const [scheme, token] = (header || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
};

module.exports = { verifyGoogleToken, hashPassword, checkPassword, signToken, verifyToken, bearerToken };
