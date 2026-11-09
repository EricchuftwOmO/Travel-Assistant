const express = require('express');
const itineraries = require('../controllers/itineraryController');

// Mounted under /trips/:tripId/itineraries by tripRoutes, which already
// requires a token. mergeParams makes :tripId readable here.
const router = express.Router({ mergeParams: true });

router.get('/', itineraries.listDays);
router.get('/:dayNumber', itineraries.getDay);

router.post('/:dayNumber/items', itineraries.addItem);
router.delete('/:dayNumber/items', itineraries.clearItems);
router.put('/:dayNumber/items/order', itineraries.reorderItems);
router.get('/:dayNumber/items/:itemId', itineraries.getItem);
router.delete('/:dayNumber/items/:itemId', itineraries.removeItem);

module.exports = router;
