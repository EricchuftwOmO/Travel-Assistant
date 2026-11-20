const express = require('express');
const tripRoutes = require('./tripRoutes');
const placeRoutes = require('./placeRoutes');

// Accounts and login moved to the user service. This router is mounted at /api.
const router = express.Router();

router.use('/trips', tripRoutes);
router.use('/places', placeRoutes);

module.exports = router;
