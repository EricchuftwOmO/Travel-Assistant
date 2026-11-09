const express = require('express');
const userRoutes = require('./userRoutes');
const tripRoutes = require('./tripRoutes');
const placeRoutes = require('./placeRoutes');

const router = express.Router();

router.use('/', userRoutes);
router.use('/trips', tripRoutes);
router.use('/places', placeRoutes);

module.exports = router;
