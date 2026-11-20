const express = require('express');
const trips = require('../controllers/tripController');
const requireAuth = require('../middleware/requireAuth');
const itineraryRoutes = require('./itineraryRoutes');

const router = express.Router();

router.use(requireAuth);

router.post('/', trips.createTrip);
router.get('/', trips.listTrips);
router.get('/:tripId', trips.getTrip);
router.put('/:tripId', trips.updateTrip);
router.delete('/:tripId', trips.deleteTrip);

router.use('/:tripId/itineraries', itineraryRoutes);

module.exports = router;
