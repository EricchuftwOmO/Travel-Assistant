// GraphQL endpoint tests that need no database: auth checks, validation and error shapes.
// The full flow with PostgreSQL is covered by the Postman collection.

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@127.0.0.1:1/none';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

let server;
let base;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const gql = async (query, variables, headers = {}) => {
  const res = await fetch(`${base}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ query, variables }),
  });
  return { status: res.status, body: await res.json() };
};

test('me is null without a token', async () => {
  const { status, body } = await gql('{ me { id } }');
  assert.equal(status, 200);
  assert.deepEqual(body.data, { me: null });
});

test('me is null with a forged token', async () => {
  const { body } = await gql('{ me { id } }', undefined, { Authorization: 'Bearer not.a.token' });
  assert.deepEqual(body.data, { me: null });
});

test('updateMe without a token is UNAUTHENTICATED', async () => {
  const { status, body } = await gql('mutation { updateMe(input: { name: "A", email: "a@b.co" }) { id } }');
  assert.equal(status, 200);
  assert.equal(body.errors[0].extensions.code, 'UNAUTHENTICATED');
  assert.equal(body.errors[0].extensions.status, 401);
});

test('register lists every invalid field as BAD_USER_INPUT', async () => {
  const { body } = await gql(
    'mutation ($input: RegisterInput!) { register(input: $input) { token } }',
    { input: { name: ' ', email: 'nope', password: 'short' } }
  );
  const [error] = body.errors;
  assert.equal(error.extensions.code, 'BAD_USER_INPUT');
  assert.equal(error.extensions.details.length, 3);
});

test('a query that does not match the schema is a 400', async () => {
  const { status, body } = await gql('{ me { password } }');
  assert.equal(status, 400);
  assert.equal(body.errors[0].extensions.code, 'GRAPHQL_VALIDATION_FAILED');
});

test('a body without a query is a 400', async () => {
  const res = await fetch(`${base}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(res.status, 400);
});

test('the schema text is served', async () => {
  const res = await fetch(`${base}/graphql/schema`);
  assert.match(await res.text(), /type Mutation/);
});
