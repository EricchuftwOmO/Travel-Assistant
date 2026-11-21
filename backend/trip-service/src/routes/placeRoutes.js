const express = require('express');
const places = require('../controllers/placeController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

router.get('/', places.listPlaces); // the sample catalog
router.get('/config', places.placesConfig);
router.get('/nearby', places.nearbyPlaces); // Google Places
router.get('/locate', places.locatePlace); // Google Places

module.exports = router;
