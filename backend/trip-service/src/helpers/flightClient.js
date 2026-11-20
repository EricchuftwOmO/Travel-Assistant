const ApiError = require('./ApiError');

// Reads a flight from the flight service (service-to-service call on the internal network).
const FLIGHT_SERVICE_URL = process.env.FLIGHT_SERVICE_URL || 'http://localhost:3004';
const TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS) || 5000;

const fetchFlight = async (flightId) => {
  let response;
  try {
    response = await fetch(new URL(`/api/flights/${flightId}`, FLIGHT_SERVICE_URL), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(502, 'The flight service is unavailable');
  }
  if (response.status === 404) {
    throw new ApiError(400, 'Request validation failed', ['flightId does not match any flight']);
  }
  if (!response.ok) throw new ApiError(502, `The flight service answered ${response.status}`);
  return response.json();
};

module.exports = { fetchFlight };
