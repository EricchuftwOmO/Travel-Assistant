const ApiError = require('../helpers/ApiError');
const { hashPassword, checkPassword, signToken } = require('../helpers/authHelper');
const { validateRegistration, validateLogin, validateProfile } = require('../helpers/validators');
const users = require('../data/userQueries');

const UNIQUE_VIOLATION = '23505';

const rejectDuplicateEmail = (err) => {
  if (err.code === UNIQUE_VIOLATION) throw new ApiError(409, 'Email is already registered');
  throw err;
};

const register = async (req, res) => {
  const { name, email, password } = validateRegistration(req);
  const passwordHash = await hashPassword(password);
  const user = await users.createUser({ name, email, passwordHash }).catch(rejectDuplicateEmail);

  res.status(201).location('/api/users/me').json({ user, token: signToken(user.id) });
};

const login = async (req, res) => {
  const { email, password } = validateLogin(req);
  const account = await users.findCredentialsByEmail(email);

  // The same message for both cases avoids revealing which emails are registered.
  if (!account || !(await checkPassword(password, account.passwordHash))) {
    throw new ApiError(401, 'Email or password is incorrect');
  }

  const { passwordHash, ...user } = account;
  res.status(200).json({ user, token: signToken(user.id) });
};

const getMe = (req, res) => {
  res.status(200).json(req.user);
};

const updateMe = async (req, res) => {
  const profile = validateProfile(req);
  const user = await users.updateUser(req.user.id, profile).catch(rejectDuplicateEmail);
  res.status(200).json(user);
};

const deleteMe = async (req, res) => {
  await users.deleteUser(req.user.id);
  res.status(204).end();
};

module.exports = { register, login, getMe, updateMe, deleteMe };
