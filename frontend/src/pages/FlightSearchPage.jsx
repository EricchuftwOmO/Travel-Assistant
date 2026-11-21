import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { addDays, duration, formatDate, formatDateTime, formatMoney, formatRange } from '../format';
import ErrorMessage from '../components/ErrorMessage';
import Modal from '../components/Modal';
import TripForm from '../components/TripForm';

const EMPTY_SEARCH = { origin: 'SEA', destination: '', departDate: '', maxPrice: '' };

// Screen 01: search flights, then add one to a new or existing trip.
export default function FlightSearchPage() {
  const [search, setSearch] = useState(EMPTY_SEARCH);
  const [flights, setFlights] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const runSearch = async (criteria) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ sort: 'price', order: 'asc', limit: '50' });
    for (const [key, value] of Object.entries(criteria)) {
      if (String(value).trim()) params.set(key, String(value).trim());
    }
    try {
      const result = await api(`/api/flights?${params}`);
      setFlights(result.data);
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
        <label className="field">
          <span>Departing from</span>
          <input value={search.origin} onChange={set('origin')} placeholder="SEA" maxLength={3} />
        </label>
        <label className="field">
          <span>Going to</span>
          <input value={search.destination} onChange={set('destination')} placeholder="Any" maxLength={3} />
        </label>
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
            {loading ? 'Searching…' : 'Search flights'}
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
          {flights.length === 0 ? (
            <div className="empty">No flights match. Try another date or a higher budget.</div>
          ) : (
            <ul className="flight-list">
              {flights.map((flight) => (
                <li key={flight.id} className="card flight-card">
                  <div className="flight-route">
                    <span className="airport">{flight.origin}</span>
                    <span className="route-line" aria-hidden="true">
                      <span>{duration(flight.depart_at, flight.arrive_at)}</span>
                    </span>
                    <span className="airport">{flight.destination}</span>
                  </div>
                  <div className="flight-meta">
                    <strong>{flight.airline}</strong> · {flight.flight_number}
                    <div className="muted small">
                      {formatDateTime(flight.depart_at)} → {formatDateTime(flight.arrive_at)}
                    </div>
                  </div>
                  <div className="flight-price">
                    <strong>{formatMoney(flight.price, flight.currency)}</strong>
                    <span className="muted small">{flight.seats_available} seats left</span>
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
    api('/api/trips?status=upcoming')
      .then((list) => {
        setTrips(list);
        if (list.length) setTripId(String(list[0].id));
      })
      .catch(setError);
  }, []);

  // The trip starts on the departure day, in the traveler's own time zone.
  const departed = new Date(flight.depart_at);
  const startDate = [
    departed.getFullYear(),
    String(departed.getMonth() + 1).padStart(2, '0'),
    String(departed.getDate()).padStart(2, '0'),
  ].join('-');
  const city = DESTINATION_NAMES[flight.destination] || flight.destination;

  const createTrip = async (form) => {
    setBusy(true);
    setError(null);
    try {
      const trip = await api('/api/trips', { method: 'POST', body: { ...form, flightId: flight.id } });
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
      await api(`/api/trips/${tripId}/flights`, { method: 'POST', body: { flightId: flight.id } });
      navigate(`/trips/${tripId}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Modal title="Add to Trip" onClose={onClose}>
      <p className="muted">
        {flight.airline} {flight.flight_number} · {flight.origin} → {flight.destination} ·{' '}
        {formatDate(flight.depart_at)} · {formatMoney(flight.price, flight.currency)}
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
