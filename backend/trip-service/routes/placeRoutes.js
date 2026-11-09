const express = require('express');
const places = require('../controllers/placeController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', requireAuth, places.listPlaces);

module.exports = router;
