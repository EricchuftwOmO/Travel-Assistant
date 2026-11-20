const { Pool, types } = require('pg');

// Keep DATE columns as 'YYYY-MM-DD' strings. By default pg converts them to
// local-time Date objects, which can shift the day when serialized to JSON.
const DATE_OID = 1082;
types.setTypeParser(DATE_OID, (value) => value);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => {
  console.error('Unexpected database error:', err.message);
});

const query = (text, params) => pool.query(text, params);

// Runs work(client) in one transaction: its queries all take effect, or none do.
const withTransaction = async (work) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { query, withTransaction };
