import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { flightsApi, tripsApi } from '../api';
import { addDays, duration, formatDate, formatDateTime, formatLocalTime, formatMoney, formatRange } from '../format';
import AirportInput from '../components/AirportInput';
import ErrorMessage from '../components/ErrorMessage';
import Modal from '../components/Modal';
import TripForm from '../components/TripForm';

const EMPTY_SEARCH = { origin: 'SEA', destination: '', departDate: '', maxPrice: '' };

const AIRPORT = /^[A-Z]{3}$/;
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// The flight service searches Google Flights live only with an origin, a destination and a future date.
const wantsLive = ({ origin, destination, departDate }) =>
  AIRPORT.test(origin?.trim() || '') && AIRPORT.test(destination?.trim() || '') && Boolean(departDate) && departDate >= todayLocal();

const stopsLabel = (stops) => (stops == null ? null : stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`);

// What the list is made of, in one line above it.
function SourceNote({ criteria, flights }) {
  if (!criteria || !flights) return null;
  const live = flights.some((flight) => flight.source === 'serpapi');
  if (wantsLive(criteria)) {
    return live ? (
      <p className="source-note source-live">● Live results from Google Flights, cheapest first. Times are local to each airport.</p>
    ) : (
      <p className="source-note source-fallback">
        Live Google Flights search isn't available right now, or found nothing for this route. Showing flights from our
        catalog instead.
      </p>
    );
  }
  return (
    <p className="source-note muted small">
      Showing flights from our catalog. Enter <strong>from</strong>, <strong>to</strong> and a <strong>date</strong> to
      search Google Flights live.
    </p>
  );
}

// Screen 01: search flights, then add one to a new or existing trip.
export default function FlightSearchPage() {
  const [search, setSearch] = useState(EMPTY_SEARCH);
  const [flights, setFlights] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [searched, setSearched] = useState(null); // the criteria the list shows

  const runSearch = async (criteria) => {
    setLoading(true);
    setError(null);
    try {
      setFlights(await flightsApi.search(criteria));
      setSearched(criteria);
    } catch (err) {
      setError(err);
      setFlights(null);
    } finally {
      setLoading(false);
    }
  };

  // Show everything from the default origin on first load.
  useEffect(() => {
    runSearch(EMPTY_SEARCH);
  }, []);

  const set = (field) => (event) =>
    setSearch((current) => ({
      ...current,
      [field]: field === 'origin' || field === 'destination' ? event.target.value.toUpperCase() : event.target.value,
    }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Screen 01</p>
          <h1>Find a flight</h1>
        </div>
      </div>

      <form
        className="card search-form"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch(search);
        }}
      >
        <div className="field">
          <span>Departing from</span>
          <AirportInput
            label="Departing from"
            value={search.origin}
            onChange={(code) => setSearch((current) => ({ ...current, origin: code }))}
            placeholder="City or airport, e.g. Seattle"
          />
        </div>
        <div className="field">
          <span>Going to</span>
          <AirportInput
            label="Going to"
            value={search.destination}
            onChange={(code) => setSearch((current) => ({ ...current, destination: code }))}
            placeholder="Any, e.g. Tokyo or TPE"
          />
        </div>
        <label className="field">
          <span>Departure date</span>
          <input type="date" value={search.departDate} onChange={set('departDate')} />
        </label>
        <label className="field">
          <span>Max budget (USD)</span>
          <input type="number" min="0" step="1" value={search.maxPrice} onChange={set('maxPrice')} placeholder="1000" />
        </label>
        <div className="search-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (wantsLive(search) ? 'Searching Google Flights…' : 'Searching…') : 'Search flights'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setSearch({ ...EMPTY_SEARCH, origin: '' });
              runSearch({ ...EMPTY_SEARCH, origin: '' });
            }}
          >
            Show all
          </button>
        </div>
      </form>

      <ErrorMessage error={error} />

      {flights && (
        <section>
          <h2 className="section-title">
            Available flights <span className="count">{flights.length}</span>
          </h2>
          <SourceNote criteria={searched} flights={flights} />
          {flights.length === 0 ? (
            <div className="empty">No flights match. Try another date or a higher budget.</div>
          ) : (
            <ul className="flight-list">
              {flights.map((flight) => (
                <li key={flight.id} className="card flight-card">
                  <div className="flight-route">
                    <span className="airport">{flight.origin}</span>
                    <span className="route-line" aria-hidden="true">
                      <span>{duration(flight.departAt, flight.arriveAt)}</span>
                    </span>
                    <span className="airport">{flight.destination}</span>
                  </div>
                  <div className="flight-meta">
                    <strong>{flight.airline}</strong> · {flight.flightNumber}
                    {flight.source === 'serpapi' && <span className="badge badge-live">Google Flights</span>}
                    <div className="muted small">
                      {flight.departLocal && flight.arriveLocal
                        ? `${formatLocalTime(flight.departLocal)} → ${formatLocalTime(flight.arriveLocal)} (local)`
                        : `${formatDateTime(flight.departAt)} → ${formatDateTime(flight.arriveAt)}`}
                    </div>
                    {stopsLabel(flight.stops) && <div className="muted small">{stopsLabel(flight.stops)}</div>}
                  </div>
                  <div className="flight-price">
                    <strong>{formatMoney(flight.price, flight.currency)}</strong>
                    {flight.seatsAvailable != null && <span className="muted small">{flight.seatsAvailable} seats left</span>}
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => setSelected(flight)}>
                    Add to Trip
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {selected && <AddToTripDialog flight={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

const DESTINATION_NAMES = { HND: 'Tokyo', NRT: 'Tokyo', TPE: 'Taipei', ICN: 'Seoul', SEA: 'Seattle', LAX: 'Los Angeles', SFO: 'San Francisco' };

function AddToTripDialog({ flight, onClose }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('new');
  const [trips, setTrips] = useState(null);
  const [tripId, setTripId] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    tripsApi
      .list({ status: 'upcoming' })
      .then((list) => {
        setTrips(list);
        if (list.length) setTripId(String(list[0].id));
      })
      .catch(setError);
  }, []);

  // The trip starts on the departure day: the local date at the airport for live results,
  // otherwise the date in the traveler's own time zone.
  const departed = new Date(flight.departAt);
  const startDate = flight.departLocal
    ? flight.departLocal.slice(0, 10)
    : [
        departed.getFullYear(),
        String(departed.getMonth() + 1).padStart(2, '0'),
        String(departed.getDate()).padStart(2, '0'),
      ].join('-');
  const city = DESTINATION_NAMES[flight.destination] || flight.destination;

  const createTrip = async (form) => {
    setBusy(true);
    setError(null);
    try {
      const trip = await tripsApi.create({ ...form, flightId: flight.id });
      navigate(`/trips/${trip.id}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  const addToExisting = async () => {
    setBusy(true);
    setError(null);
    try {
      await tripsApi.attachFlight(tripId, flight.id);
      navigate(`/trips/${tripId}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Modal title="Add to Trip" onClose={onClose}>
      <p className="muted">
        {flight.airline} {flight.flightNumber} · {flight.origin} → {flight.destination} ·{' '}
        {formatDate(flight.departAt)} · {formatMoney(flight.price, flight.currency)}
      </p>

      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'new'} onClick={() => setMode('new')}>
          + Create New Trip
        </button>
        <button type="button" role="tab" aria-selected={mode === 'existing'} onClick={() => setMode('existing')}>
          Add to Existing Trip
        </button>
      </div>

      <ErrorMessage error={error} />

      {mode === 'new' ? (
        <TripForm
          initial={{ title: `${city} Trip`, destination: city, startDate, endDate: addDays(startDate, 6) }}
          onSubmit={createTrip}
          submitLabel="Create trip with this flight"
          busy={busy}
        />
      ) : trips === null ? (
        <p className="muted">Loading your trips…</p>
      ) : trips.length === 0 ? (
        <div className="empty">You have no upcoming trips yet. Create a new one instead.</div>
      ) : (
        <div className="form">
          <label className="field">
            <span>Trip</span>
            <select value={tripId} onChange={(event) => setTripId(event.target.value)}>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title} ({formatRange(trip.startDate, trip.endDate)})
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={addToExisting}>
            {busy ? 'Adding…' : 'Add flight to this trip'}
          </button>
        </div>
      )}
    </Modal>
  );
}
