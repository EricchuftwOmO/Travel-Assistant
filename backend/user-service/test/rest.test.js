// REST tests that need no database: token checks, request validation and the Google sign-in
// guards. The full flow with PostgreSQL is covered by the Postman collection.

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@127.0.0.1:1/none';
delete process.env.GOOGLE_CLIENT_ID;

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const app = require('../src/app');

let server;
let base;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const call = async (method, path, { body, token } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { res, body: res.status === 204 ? null : await res.json() };
};

const badTokens = [
  undefined,
  'not.a.jwt',
  jwt.sign({ userId: 1 }, 'wrong-secret'),
  jwt.sign({ userId: 1 }, 'test-secret', { expiresIn: -10 }),
];

test('protected routes reject a missing, malformed, wrongly signed or expired token', async () => {
  for (const [method, path] of [
    ['GET', '/api/auth/validate'],
    ['GET', '/api/users/me'],
    ['PUT', '/api/users/me'],
    ['DELETE', '/api/users/me'],
    ['PATCH', '/api/users/me/basic-info'],
    ['GET', '/api/users/me/language-settings'],
    ['PATCH', '/api/users/me/language-settings'],
    ['GET', '/api/users/me/travel-preferences'],
    ['PATCH', '/api/users/me/travel-preferences'],
  ]) {
    for (const token of badTokens) {
      const { res, body } = await call(method, path, { token });
      assert.equal(res.status, 401, `${method} ${path} ${token}`);
      assert.equal(res.headers.get('www-authenticate'), 'Bearer');
      assert.equal(body.error.code, 'UNAUTHORIZED');
    }
  }
});

test('login and register validate the body', async () => {
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'a@b.co' } })).res.status, 400);
  assert.equal((await call('POST', '/api/auth/register', { body: { name: 'A', email: 'x', password: '1' } })).res.status, 400);
});

test('google sign-in: a missing credential is a 400', async () => {
  for (const body of [{}, { credential: 5 }, { credential: '' }]) {
    const { res, body: out } = await call('POST', '/api/auth/google', { body });
    assert.equal(res.status, 400);
    assert.equal(out.error.code, 'BAD_REQUEST');
  }
});

test('google sign-in: 503 when GOOGLE_CLIENT_ID is not set', async () => {
  const { res, body } = await call('POST', '/api/auth/google', { body: { credential: 'abc' } });
  assert.equal(res.status, 503);
  assert.equal(body.error.message, 'Google sign-in is not configured');
});

test('google sign-in: an invalid Google token is a 401', async () => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  // Stubbed: the real check downloads Google's certificates first, which needs the network.
  const original = OAuth2Client.prototype.verifyIdToken;
  OAuth2Client.prototype.verifyIdToken = async () => {
    throw new Error('Wrong number of segments in token');
  };
  try {
    const { res, body } = await call('POST', '/api/auth/google', { body: { credential: 'garbage' } });
    assert.equal(res.status, 401);
    assert.equal(body.error.message, 'Google token is invalid or expired');
  } finally {
    OAuth2Client.prototype.verifyIdToken = original;
    delete process.env.GOOGLE_CLIENT_ID;
  }
});

test('the GraphQL routes are gone', async () => {
  assert.equal((await call('POST', '/api/graphql', { body: { query: '{ me { id } }' } })).res.status, 404);
  assert.equal((await call('POST', '/graphql', { body: { query: '{ me { id } }' } })).res.status, 404);
});
