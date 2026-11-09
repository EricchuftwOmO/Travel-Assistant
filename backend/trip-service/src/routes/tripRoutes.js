const express = require('express');
const trips = require('../controllers/tripController');
const requireAuth = require('../middleware/requireAuth');
const itineraryRoutes = require('./itineraryRoutes');

const router = express.Router();

// 在這個子路由器（Router）管轄的範圍內，套用一個「中間件（Middleware）
router.use(requireAuth);

router.post('/', trips.createTrip);
router.get('/', trips.listTrips);
router.get('/:tripId', trips.getTrip);
router.put('/:tripId', trips.updateTrip);
router.delete('/:tripId', trips.deleteTrip);

// A trip's days and places, nested under the trip they belong to.
router.use('/:tripId/itineraries', itineraryRoutes);

module.exports = router;
