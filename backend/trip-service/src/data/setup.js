const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// The trip service owns its own database on the shared PostgreSQL server.
// On first start it creates the database, the tables and the sample data;
// later starts find the tables and leave the data alone.

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

// Run schema.sql and seed.sql in one transaction if the tables are missing.
const ensureSchema = async (db) => {
  const { rows } = await db.query("SELECT to_regclass('public.users') AS existing");
  if (rows[0].existing) return false;

  const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
  await db.withTransaction(async (client) => {
    await client.query(read('schema.sql'));
    await client.query(read('seed.sql'));
  });
  return true;
};

module.exports = { ensureDatabase, ensureSchema };
