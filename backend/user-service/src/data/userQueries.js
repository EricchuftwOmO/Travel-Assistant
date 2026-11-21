const db = require('./db');

// password_hash is left out so it can never reach an API response by accident.
// "name" is the display name, built from first and last name.
const PUBLIC_COLUMNS = `id,
  first_name AS "firstName", last_name AS "lastName",
  btrim(first_name || ' ' || last_name) AS name,
  email, gender, to_char(date_of_birth, 'YYYY-MM-DD') AS "dateOfBirth",
  phone, country, language, timezone,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"`;

const createUser = async ({ firstName, lastName, email, passwordHash }) => {
  const { rows } = await db.query(
    `INSERT INTO users (first_name, last_name, email, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [firstName, lastName, email, passwordHash]
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

// Columns a profile update may change, keyed by the API field name.
const UPDATABLE = {
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  gender: 'gender',
  dateOfBirth: 'date_of_birth',
  phone: 'phone',
  country: 'country',
  language: 'language',
  timezone: 'timezone',
};

// The account for a Google identity: the one linked to this google_sub, else an unlinked account
// with the same email (which becomes linked), else a new one. Returns { user } or { conflict: true }
// when the email belongs to an account linked to a different Google identity.
const findOrCreateGoogleUser = async ({ sub, email, firstName, lastName }) => {
  const bySub = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE google_sub = $1`, [sub]);
  if (bySub.rows[0]) return { user: bySub.rows[0] };

  const { rows } = await db.query(
    `INSERT INTO users (first_name, last_name, email, google_sub) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET google_sub = EXCLUDED.google_sub WHERE users.google_sub IS NULL
     RETURNING ${PUBLIC_COLUMNS}`,
    [firstName, lastName, email, sub]
  );
  return rows[0] ? { user: rows[0] } : { conflict: true };
};

// Partial update: only the fields present in `changes` are written (null clears an optional field).
const updateUser = async (id, changes) => {
  const sets = [];
  const params = [id];
  for (const [field, column] of Object.entries(UPDATABLE)) {
    if (changes[field] === undefined) continue;
    params.push(changes[field]);
    sets.push(`${column} = $${params.length}`);
  }
  if (!sets.length) return findUserById(id);
  const { rows } = await db.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    params
  );
  return rows[0];
};

// The trip service deletes the trips itself (see accounts.js); preferences cascade.
const deleteUser = async (id) => {
  await db.query('DELETE FROM users WHERE id = $1', [id]);
};

const findTravelPreferences = async (userId) => {
  const { rows } = await db.query(
    `SELECT budget_level AS "budgetLevel", travel_styles AS "travelStyles"
     FROM travel_preferences WHERE user_id = $1`,
    [userId]
  );
  // A user who never saved preferences gets the empty defaults.
  return rows[0] || { budgetLevel: null, travelStyles: [] };
};

// Saves only the given fields; the row is created on first save.
const saveTravelPreferences = async (userId, { budgetLevel, travelStyles }) => {
  const { rows } = await db.query(
    `INSERT INTO travel_preferences (user_id, budget_level, travel_styles)
     VALUES ($1, $2, COALESCE($3::text[], '{}'))
     ON CONFLICT (user_id) DO UPDATE SET
       budget_level  = CASE WHEN $4 THEN EXCLUDED.budget_level ELSE travel_preferences.budget_level END,
       travel_styles = CASE WHEN $5 THEN EXCLUDED.travel_styles ELSE travel_preferences.travel_styles END,
       updated_at    = NOW()
     RETURNING budget_level AS "budgetLevel", travel_styles AS "travelStyles"`,
    [userId, budgetLevel ?? null, travelStyles ?? null, budgetLevel !== undefined, travelStyles !== undefined]
  );
  return rows[0];
};

module.exports = {
  createUser,
  findUserById,
  findCredentialsByEmail,
  findOrCreateGoogleUser,
  updateUser,
  deleteUser,
  findTravelPreferences,
  saveTravelPreferences,
};
