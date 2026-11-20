const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// The user service owns its own database on the shared PostgreSQL server.
// schema.sql runs on every start (it only adds what is missing, and upgrades older tables);
// the sample users are loaded only into an empty table.

// Create the database named in DATABASE_URL if the server does not have it yet.
const ensureDatabase = async () => {
  const url = new URL(process.env.DATABASE_URL);
  const dbName = decodeURIComponent(url.pathname.slice(1));
  url.pathname = '/postgres';

  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (!rowCount) await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  } finally {
    await admin.end();
  }
};

// Returns true when the sample data was loaded (first start).
const ensureSchema = async (db) => {
  const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
  return db.withTransaction(async (client) => {
    await client.query(read('schema.sql'));
    const { rows } = await client.query('SELECT EXISTS (SELECT 1 FROM users) AS has_users');
    if (rows[0].has_users) return false;
    await client.query(read('seed.sql'));
    return true;
  });
};

module.exports = { ensureDatabase, ensureSchema };
