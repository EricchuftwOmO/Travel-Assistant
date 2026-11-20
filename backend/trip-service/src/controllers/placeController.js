const { validatePlaceFilters } = require('../helpers/validators');
const places = require('../data/placeQueries');

const listPlaces = async (req, res) => {
  const results = await places.listPlaces(validatePlaceFilters(req));
  res.status(200).set('X-Total-Count', String(results.length)).json(results);
};

module.exports = { listPlaces };
