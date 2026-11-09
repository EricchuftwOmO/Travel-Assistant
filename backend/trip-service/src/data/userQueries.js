const db = require('./db');

// password_hash is left out so it can never reach an API response by accident.
const PUBLIC_COLUMNS = `id, name, email, created_at AS "createdAt"`;

const createUser = async ({ name, email, passwordHash }) => {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash]
  );
  return rows[0];
};

const findUserById = async (id) => {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
};

// The only query that returns password_hash; used to check a login attempt.
const findCredentialsByEmail = async (email) => {
  const { rows } = await db.query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash AS "passwordHash" FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
};

const updateUser = async (id, { name, email }) => {
  const { rows } = await db.query(
    `UPDATE users SET name = $2, email = $3 WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, name, email]
  );
  return rows[0];
};

// The user's trips are removed by ON DELETE CASCADE.
const deleteUser = async (id) => {
  await db.query('DELETE FROM users WHERE id = $1', [id]);
};

module.exports = { createUser, findUserById, findCredentialsByEmail, updateUser, deleteUser };
