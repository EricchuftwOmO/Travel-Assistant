// The REST API. The gateway forwards /api/auth and /api/users here, and calls GET /api/auth/validate
// to check the token on every other protected route.

const express = require('express');
const ApiError = require('./helpers/ApiError');
const accounts = require('./accounts');
const requireUser = require('./middleware/requireUser');

const router = express.Router();

// ---------- Auth (public) ----------
router.post('/auth/register', async (req, res) => {
  res.status(201).json(await accounts.register(req.body));
});

router.post('/auth/login', async (req, res) => {
  res.status(200).json(await accounts.login(req.body));
});

router.post('/auth/google', async (req, res) => {
  res.status(200).json(await accounts.googleLogin(req.body));
});

// Is this token good? Used by the gateway. Light: no profile lookups.
router.get('/auth/validate', requireUser, (req, res) => {
  res.status(200).json({ userId: req.user.id });
});

// ---------- Users: always "me" (the account comes from the token) ----------
router.use('/users/me', requireUser);

router.get('/users/me', async (req, res) => res.json(await accounts.getProfile(req.user)));

router.put('/users/me', async (req, res) => {
  res.json(await accounts.getProfile(await accounts.updateProfile(req.user.id, req.body)));
});

router.delete('/users/me', async (req, res) => {
  await accounts.deleteAccount(req.user.id);
  res.status(204).end();
});

router.patch('/users/me/basic-info', async (req, res) => {
  res.json(await accounts.updateBasicInfo(req.user.id, req.body));
});

router.get('/users/me/language-settings', (req, res) => {
  res.json({ language: req.user.language, timezone: req.user.timezone });
});
router.patch('/users/me/language-settings', async (req, res) => {
  res.json(await accounts.updateLanguageSettings(req.user.id, req.body));
});

router.get('/users/me/travel-preferences', async (req, res) => {
  res.json(await accounts.getTravelPreferences(req.user.id));
});
router.patch('/users/me/travel-preferences', async (req, res) => {
  res.json(await accounts.updateTravelPreferences(req.user.id, req.body));
});

module.exports = router;
