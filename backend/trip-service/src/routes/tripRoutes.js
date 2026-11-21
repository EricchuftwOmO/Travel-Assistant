const express = require('express');
const trips = require('../controllers/tripController');
const tripFlights = require('../controllers/tripFlightController');
const requireAuth = require('../middleware/requireAuth');
const itineraryRoutes = require('./itineraryRoutes');

const router = express.Router();

router.use(requireAuth);

router.post('/', trips.createTrip);
router.get('/', trips.listTrips);
router.get('/:tripId', trips.getTrip);
router.put('/:tripId', trips.updateTrip);
router.delete('/:tripId', trips.deleteTrip);

router.get('/:tripId/flights', tripFlights.listFlights);
router.post('/:tripId/flights', tripFlights.addFlight);
router.delete('/:tripId/flights/:tripFlightId', tripFlights.removeFlight);

router.use('/:tripId/itineraries', itineraryRoutes);

module.exports = router;
