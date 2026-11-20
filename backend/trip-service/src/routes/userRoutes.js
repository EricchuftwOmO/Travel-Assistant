const express = require('express');
const users = require('../controllers/userController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.post('/auth/register', users.register);
router.post('/auth/login', users.login);

// Always "me": the account comes from the token, so no user can address another.
router.get('/users/me', requireAuth, users.getMe);
router.put('/users/me', requireAuth, users.updateMe);
router.delete('/users/me', requireAuth, users.deleteMe);

module.exports = router;
